# -*- coding: utf-8 -*-
"""
هل الخلفية الصامت (Quick Popup) — يعمل في خلفية ويندوز حصراً بمكتبات بايثون القياسية:
ctypes (اختصارات + نافذة رسائل + حافظة) و tkinter (نافذة التوست العائمة).
مشغل من server.py، وينضم لإعدادات الشائع /api/bg.
"""
import os
import sys
import time
import json
import queue
import threading
import urllib.request
import ctypes
import ctypes.wintypes as wt

ROOT = os.path.dirname(sys.executable if getattr(sys, "frozen", False) else os.path.abspath(__file__))
BG_URL = "http://127.0.0.1:8787/api/bg"
QUICK_URL = "http://127.0.0.1:8787/api/quick"
LOG_PATH = os.path.join(ROOT, "bg_agent.log")
AGENT_PID = os.path.join(ROOT, ".bgagepid")

HS_GENERATE = 0x9001
HS_REOPEN = 0x9002
TIMER_REFRESH = 1
HWND_MESSAGE = -3

MOD_ALT = 0x0001
MOD_CONTROL = 0x0002
MOD_SHIFT = 0x0004
MOD_WIN = 0x0008
MOD_NOREPEAT = 0x4000
CF_UNICODETEXT = 13
VK_MAP = {
    "space": 0x20, "enter": 0x0D, "tab": 0x09, "back": 0x08,
    "delete": 0x2E, "esc": 0x1B, "home": 0x24, "end": 0x23,
    "up": 0x26, "down": 0x28, "left": 0x25, "right": 0x27,
    "pageup": 0x21, "pagedown": 0x22, "insert": 0x2D,
}
MOD_NAMES = {"ctrl": MOD_CONTROL, "alt": MOD_ALT, "shift": MOD_SHIFT, "win": MOD_WIN}


def _log(msg):
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write("%s %s\n" % (time.strftime("%H:%M:%S"), msg))
    except Exception:
        pass


def _pid_write():
    try:
        with open(AGENT_PID, "w") as f:
            f.write(str(os.getpid()))
    except Exception:
        pass


def _pid_clear():
    try:
        if os.path.isfile(AGENT_PID):
            os.remove(AGENT_PID)
    except Exception:
        pass


_q_clip = queue.Queue()


# ── دوال نقية قابلة للاختبار ──
def parse_hotkey(s):
    """يحوّل 'Ctrl+Alt+Space' إلى (mods, vk) أو None عند الفشل."""
    if not s or not isinstance(s, str):
        return None
    parts = [p.strip().lower() for p in s.split("+") if p.strip()]
    if not parts:
        return None
    mods = 0
    for m in parts[:-1]:
        if m in MOD_NAMES:
            mods |= MOD_NAMES[m]
        else:
            return None
    key = parts[-1]
    vk = VK_MAP.get(key)
    if vk is None:
        if len(key) == 1 and key.isalnum():
            vk = ord(key.upper())
        elif len(key) == 2 and key[0] == "f" and key[1:].isdigit():
            fn = int(key[1:])
            if 1 <= fn <= 24:
                vk = 0x70 + fn - 1
    if not vk:
        return None
    return mods | MOD_NOREPEAT, vk


# ── طبقة ويندوز (حافظة + إرسال مفاتيح) ──
def clip_get_text():
    try:
        if not ctypes.windll.user32.OpenClipboard(None):
            return None
        try:
            if not ctypes.windll.user32.IsClipboardFormatAvailable(CF_UNICODETEXT):
                return None
            h = ctypes.windll.user32.GetClipboardData(CF_UNICODETEXT)
            if not h:
                return None
            ptr = ctypes.windll.kernel32.GlobalLock(h)
            if not ptr:
                return None
            try:
                return ctypes.wstring_at(ptr)
            finally:
                ctypes.windll.kernel32.GlobalUnlock(h)
        finally:
            ctypes.windll.user32.CloseClipboard()
    except Exception:
        return None


def clip_set_text(t):
    payload = (t or "").encode("utf-16-le") + b"\x00\x00"
    h = ctypes.windll.kernel32.GlobalAlloc(0x0042, len(payload))
    if not h:
        return False
    ptr = ctypes.windll.kernel32.GlobalLock(h)
    ctypes.memmove(ptr, payload, len(payload))
    ctypes.windll.kernel32.GlobalUnlock(h)
    try:
        if not ctypes.windll.user32.OpenClipboard(None):
            return False
        try:
            ctypes.windll.user32.EmptyClipboard()
            return bool(ctypes.windll.user32.SetClipboardData(CF_UNICODETEXT, h))
        finally:
            ctypes.windll.user32.CloseClipboard()
    except Exception:
        return False


def clip_clear():
    ctypes.windll.user32.OpenClipboard(None)
    try:
        ctypes.windll.user32.EmptyClipboard()
    finally:
        ctypes.windll.user32.CloseClipboard()


def clip_sequence():
    return ctypes.windll.user32.GetClipboardSequenceNumber()


def clip_read_sync(timeout=3.0):
    """قراءة نص الحافظة عبر خيط Tk (يقرأ صيغ OLE/المؤجّلة التي يعجز عنها GlobalLock).
    يرجع نصاً أو None."""
    try:
        slot = {"ev": threading.Event(), "val": None}
        _q_clip.put(slot)
        ok = slot["ev"].wait(timeout)
        return slot["val"] if ok else None
    except Exception:
        try:
            return clip_get_text()
        except Exception:
            return None


class _KEYBDINPUT(ctypes.Structure):
    _fields_ = [("wVk", wt.WORD), ("wScan", wt.WORD), ("dwFlags", wt.DWORD),
                ("time", wt.DWORD), ("dwExtraInfo", ctypes.c_size_t)]


class _MOUSEINPUT(ctypes.Structure):
    _fields_ = [("dx", ctypes.c_long), ("dy", ctypes.c_long), ("mouseData", wt.DWORD),
                ("dwFlags", wt.DWORD), ("time", wt.DWORD), ("dwExtraInfo", ctypes.c_size_t)]


class _INPUTKEY(ctypes.Union):
    _fields_ = [("ki", _KEYBDINPUT), ("mi", _MOUSEINPUT)]


class _INPUT(ctypes.Structure):
    _anonymous_ = ("_i",)
    _fields_ = [("type", wt.DWORD), ("_i", _INPUTKEY)]


def _key_event(vk, flags):
    inp = _INPUT()
    inp.type = 1
    inp.ki.wVk = vk
    inp.ki.dwFlags = flags
    return inp


def send_ctrl_c():
    return _copy_key_chord(0x43)


def _copy_key_chord(vk, extended=False):
    """Ctrl+VK لحظة مع تحرير مفاتيح التعديل مثل Alt و Shift لضمان عدم تعارضها."""
    user32 = ctypes.windll.user32
    alt_down = bool(user32.GetAsyncKeyState(0x12) & 0x8000)
    shift_down = bool(user32.GetAsyncKeyState(0x10) & 0x8000)

    events = []
    if alt_down:
        events.append(_key_event(0x12, 2))  # Alt UP
    if shift_down:
        events.append(_key_event(0x10, 2))  # Shift UP

    ex = (0x1 if extended else 0)
    events.append(_key_event(0x11, 0))       # Ctrl DOWN
    events.append(_key_event(vk, ex))        # VK DOWN
    events.append(_key_event(vk, ex | 2))    # VK UP
    events.append(_key_event(0x11, 2))       # Ctrl UP

    n = len(events)
    inp = (_INPUT * n)(*events)
    try:
        if alt_down or shift_down:
            time.sleep(0.04)
        return user32.SendInput(n, ctypes.byref(inp), ctypes.sizeof(_INPUT))
    except Exception:
        return 0


def capture_selection():
    """نسخ التحديد بأمان: Ctrl+C (ثم Ctrl+Insert احتياطاً) مع قراءة الحافظة.
    مهم: معظم التطبيقات (متصفح/مفكرة) تستخدم «التصيير المؤجّل» — يتغير الرقم التسلسلي
    للمحفظة فقط عند القراءة الفعلية، لذلك نعتمد على القراءة نفسها لتفعيل التقديم.
    عند النجاح يبقى النص المحدد في الحافظة (سلوك QuickTranslate)، وعند الفشل تُستعاد الحافظة القديمة."""
    before = clip_read_sync()
    seq0 = clip_sequence()

    def _read_new():
        t = clip_read_sync()
        if t and t.strip() and (t != before or clip_sequence() != seq0):
            return t.strip()
        return None

    sent = _copy_key_chord(0x43)  # Ctrl+C
    _log("حقن Ctrl+C: %d" % sent)
    selected = None
    deadline = time.time() + 1.2
    while time.time() < deadline:
        selected = _read_new()
        if selected is not None:
            break
        # القراءة تفرض التقديم على المالك (Delayed Rendering) — ثم نعيد المحاولة
        clip_read_sync()
        selected = _read_new()
        if selected is not None:
            break
        time.sleep(0.05)
    if selected is None:
        sent2 = _copy_key_chord(0x2D, extended=True)  # Ctrl+Insert احتياط
        _log("متابعة بـ Ctrl+Insert: %d" % sent2)
        deadline = time.time() + 1.0
        while time.time() < deadline:
            selected = _read_new()
            if selected is not None:
                break
            clip_read_sync()
            selected = _read_new()
            if selected is not None:
                break
            time.sleep(0.05)
    if selected is None:
        if before and before.strip() and len(before.strip()) >= 2:
            _log("استخدام النص الموجود بالحافظة: %d حرف" % len(before.strip()))
            return before.strip()
        _log("تعذر نسخ التحديد — استعادة الحافظة")
        if before is not None:
            clip_set_text(before)
        return None
    _log("التقط النص: %d حرف" % len(selected))
    return selected


# ── مدير الإعدادات (قراءة من /api/bg مع نسخة محلية) ──
class Settings:
    def __init__(self):
        self._lock = threading.Lock()
        self.cfg = {}
        self.fail_streak = 0

    def get(self, k, d=None):
        with self._lock:
            return self.cfg.get(k, d)

    def load(self):
        # ── القراءة المباشرة من الملف (ضامنة دائماً) ──
        file_cfg = {}
        try:
            cfg_path = os.path.join(ROOT, "bg_config.json")
            if os.path.isfile(cfg_path):
                with open(cfg_path, "r", encoding="utf-8") as f:
                    file_cfg = json.load(f) or {}
        except Exception:
            pass

        # ── تحديث الإعدادات من السيرفر (تكاملي إضافي) ──
        try:
            with urllib.request.urlopen(BG_URL, timeout=4) as r:
                data = json.loads(r.read().decode("utf-8")) or {}
            srv_cfg = data.get("settings", {}) or {}
            # الملف هو المصدر الأول — السيرفر يُتمم فقط
            merged = dict(srv_cfg)
            merged.update(file_cfg)   # الملف يتفوق على السيرفر
            with self._lock:
                self.cfg = merged
            self.fail_streak = 0
            return True
        except Exception:
            if file_cfg:
                with self._lock:
                    self.cfg = file_cfg
                self.fail_streak = 0
                return True
            self.fail_streak += 1
            return False


def post_quick(text, settings):
    payload = json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(QUICK_URL, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=420) as r:
            data = json.loads(r.read().decode("utf-8")) or {}
        if data.get("ok"):
            return data.get("answer") or "", None
        return None, data.get("error") or "تعذر توليد الرد"
    except urllib.error.HTTPError as e:
        try:
            data = json.loads(e.read().decode("utf-8") or "{}")
            return None, data.get("error") or "تعذر توليد الرد"
        except Exception:
            return None, "النموذج غير متاح الآن"
    except Exception:
        return None, "الخادم غير متصل"


# ── نافذة التوست (tkinter) ──
import tkinter as tk

COLORS_DARK = {"bg": "#151d2c", "card": "#1d2739", "fg": "#e8ecf5",
               "muted": "#9aa7c4", "accent": "#4f8cff", "err": "#ff6b5e"}
COLORS_LIGHT = {"bg": "#ffffff", "card": "#f4f6fb", "fg": "#1c2333",
                "muted": "#6b7790", "accent": "#2f6bff", "err": "#e55345"}
SIZES = {"small": 300, "medium": 420, "wide": 560}


class QuickToast:
    def __init__(self, root, answer, settings, on_copy):
        self.root = root
        self.settings = settings
        self.on_copy = on_copy
        try:
            dur_val = float(settings.get("duration", 3) or 3)
            self.duration = max(0.1, min(30.0, dur_val))
        except (ValueError, TypeError):
            self.duration = 3.0
        self._remaining = self.duration
        self._paused = False
        self._cancel = False
        color = settings.get("color", "dark")
        self.color = color
        self.c = COLORS_DARK if color == "dark" else COLORS_LIGHT
        custom_w = settings.get("custom_width")
        custom_h = settings.get("custom_height")
        size_name = settings.get("size", "medium")
        if size_name == "custom" and custom_w and custom_h:
            init_w = int(custom_w)
            init_h = int(custom_h)
        elif custom_w and custom_h and size_name not in SIZES:
            init_w = int(custom_w)
            init_h = int(custom_h)
        else:
            init_w = SIZES.get(size_name, 420)
            init_h = 320

        raw_pos = str(settings.get("position", "right") or "right").lower()
        if "left" in raw_pos:
            pos = "left"
        elif "center" in raw_pos:
            pos = "center"
        else:
            pos = "right"
        self._pos = pos

        self.win = tk.Toplevel(root)
        self.win.withdraw()
        self.win.overrideredirect(True)
        self.win.attributes("-topmost", True)
        self.win.configure(bg=self.c["card"])
        try:
            hwnd = ctypes.windll.user32.GetParent(self.win.winfo_id())
            if not hwnd:
                hwnd = self.win.winfo_id()
            ex = ctypes.windll.user32.GetWindowLongW(hwnd, -20)
            ctypes.windll.user32.SetWindowLongW(hwnd, -20, ex | 0x08000000)  # WS_EX_NOACTIVATE
        except Exception:
            pass

        # تطبيق الشفافية المحفوظة
        try:
            raw_op = settings.get("opacity")
            if raw_op is not None:
                self._opacity = max(0.2, min(1.0, float(raw_op)))
            else:
                self._opacity = 1.0
        except (ValueError, TypeError):
            self._opacity = 1.0
        self.win.attributes("-alpha", self._opacity)

        # مقبض السحب العلوي (تعديل الارتفاع بالسحب للأعلى أو الأسفل)
        self.top_edge = tk.Frame(self.win, bg=self.c["card"], height=4, cursor="size_ns")
        self.top_edge.pack(fill="x", side="top")
        self.top_edge.bind("<ButtonPress-1>", lambda e: self._on_resize_start(e, "top"))
        self.top_edge.bind("<B1-Motion>", self._on_resize_motion)
        self.top_edge.bind("<ButtonRelease-1>", self._on_resize_end)

        # مقبض السحب الجانبي (على الجانب الحر وفقاً للموضع)
        free_side = "right" if pos == "left" else "left"
        self.side_edge = tk.Frame(self.win, bg=self.c["card"], width=5, cursor="size_we")
        self.side_edge.pack(fill="y", side=free_side)
        self.side_edge.bind("<ButtonPress-1>", lambda e: self._on_resize_start(e, "side"))
        self.side_edge.bind("<B1-Motion>", self._on_resize_motion)
        self.side_edge.bind("<ButtonRelease-1>", self._on_resize_end)

        # شريط العنوان (يدعم السحب والتحريك في كامل الشاشة)
        self.head = tk.Frame(self.win, bg=self.c["card"], padx=8, pady=5, cursor="fleur")
        self.head.pack(fill="x", side="top")

        # مقبض الزاوية للسحب الحر (عرض + ارتفاع)
        grip_cursor = "size_ne_sw" if pos == "left" else "size_nw_se"
        grip_icon = "⤢" if pos == "left" else "⤡"
        self.btn_resize = tk.Label(self.head, text=grip_icon, fg=self.c["muted"], bg=self.c["card"],
                                   cursor=grip_cursor, font=("Segoe UI", 10, "bold"),
                                   padx=3)
        if pos == "left":
            self.btn_resize.pack(side="right", padx=(4, 0))
        else:
            self.btn_resize.pack(side="left", padx=(0, 4))
        self.btn_resize.bind("<ButtonPress-1>", lambda e: self._on_resize_start(e, "corner"))
        self.btn_resize.bind("<B1-Motion>", self._on_resize_motion)
        self.btn_resize.bind("<ButtonRelease-1>", self._on_resize_end)

        self.dot = tk.Label(self.head, text="●", fg=self.c["accent"], bg=self.c["card"], font=("Segoe UI", 9), cursor="fleur")
        self.dot.pack(side="left")
        self.tl = tk.Label(self.head, text="البوب-أب السريع", fg=self.c["muted"], bg=self.c["card"],
                           font=("Segoe UI", 9, "bold"), cursor="fleur")
        self.tl.pack(side="left", padx=(6, 0))

        # تمكين سحب وتحريك النافذة إلى أي مكان في الشاشة
        for _hw in (self.head, self.tl, self.dot):
            _hw.bind("<ButtonPress-1>", self._on_move_start)
            _hw.bind("<B1-Motion>", self._on_move_motion)
            _hw.bind("<ButtonRelease-1>", self._on_move_end)

        self.btn_close = tk.Label(self.head, text="✕", fg=self.c["err"], bg=self.c["card"],
                                  cursor="hand2", font=("Segoe UI", 10, "bold"))
        self.btn_close.pack(side="right")
        self.btn_close.bind("<Button-1>", lambda e: self.exit())

        self.btn_copy = tk.Label(self.head, text="نسخ", fg=self.c["fg"], bg=self.c["card"],
                                 cursor="hand2", font=("Segoe UI", 9))
        self.btn_copy.pack(side="right", padx=(0, 8))
        self.btn_copy.bind("<Button-1>", lambda e: self._do_copy(answer))
        self.btn_copy.bind("<Enter>", lambda e: self.btn_copy.config(fg=self.c["accent"]))
        self.btn_copy.bind("<Leave>", lambda e: self.btn_copy.config(fg=self.c["fg"]))

        # شريط الشفافية
        self._opacity_scale = tk.Scale(
            self.head,
            from_=20, to=100,
            orient="horizontal",
            length=70,
            showvalue=False,
            sliderlength=12,
            width=6,
            bd=0,
            highlightthickness=0,
            troughcolor=self.c["bg"],
            bg=self.c["card"],
            activebackground=self.c["accent"],
            fg=self.c["muted"],
            cursor="hand2",
            command=self._on_opacity_change,
        )
        self._opacity_scale.set(int(self._opacity * 100))
        self._opacity_scale.pack(side="right", padx=(0, 4))
        # تسمية أيقونة الشفافية
        self._opacity_lbl = tk.Label(self.head, text="◑", fg=self.c["muted"], bg=self.c["card"],
                                     font=("Segoe UI", 9), cursor="hand2")
        self._opacity_lbl.pack(side="right", padx=(0, 2))

        # زر تبديل الثيم الرسومي الفيكتور (أيقونة CSS/SVG بدون إيموجي)
        self.btn_theme_canvas = tk.Canvas(self.head, width=20, height=20, bg=self.c["card"],
                                          highlightthickness=0, cursor="hand2")
        self.btn_theme_canvas.pack(side="right", padx=(0, 6))
        self.btn_theme_canvas.bind("<Enter>", lambda e: self._render_theme_icon(hover=True))
        self.btn_theme_canvas.bind("<Leave>", lambda e: self._render_theme_icon(hover=False))
        self.btn_theme_canvas.bind("<Button-1>", lambda e: self._toggle_theme())
        self._render_theme_icon()

        # شريط التقدم الزمني في الأسفل
        self._bar = tk.Canvas(self.win, height=3, bg=self.c["bg"], highlightthickness=0)
        self._bar.pack(side="bottom", fill="x")
        self._bar_w = init_w

        # نص الإجابة في المنتصف
        self.body = tk.Text(self.win, bg=self.c["card"], fg=self.c["fg"], relief="flat",
                            font=("Segoe UI", 11), wrap="word", height=6, padx=10, pady=8,
                            cursor="arrow", highlightthickness=0, borderwidth=0)
        self.body.pack(fill="both", expand=True)
        self.body.insert("1.0", answer)
        self.body.configure(state="disabled")

        self.win.bind("<Enter>", lambda e: self._set_pause(True))
        self.win.bind("<Leave>", lambda e: self._set_pause(False))
        self.win.bind("<Button-1>", lambda e: self._set_pause(True))

        self._place(pos, init_w, init_h)
        self.win.deiconify()
        self._tick()

    def _place(self, pos, width, height=320):
        rect = wt.RECT()
        ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0)
        max_h = (rect.bottom - rect.top) - 24
        max_w = (rect.right - rect.left) - 24
        h = max(140, min(int(height or 320), max_h))
        w = max(240, min(int(width or 420), max_w))

        # هل يوجد موضع مُخصص محفوظ؟
        saved_x = self.settings.get("custom_x")
        saved_y = self.settings.get("custom_y")
        if saved_x is not None and saved_y is not None:
            try:
                sx = int(saved_x)
                sy = int(saved_y)
                # تأكد أن الموضع داخل حدود الشاشة
                sx = max(rect.left, min(sx, rect.right - w - 4))
                sy = max(rect.top, min(sy, rect.bottom - h - 4))
                self.win.geometry("%dx%d+%d+%d" % (w, h, sx, sy))
                self._bar_w = w
                return
            except Exception:
                pass

        # الموضع الافتراضي حسب إعداد الجانب
        if pos == "left":
            x = rect.left + 12
        elif pos == "center":
            x = (rect.left + rect.right - w) // 2
        else:
            x = rect.right - w - 12
        y = rect.bottom - h - 12
        self.win.geometry("%dx%d+%d+%d" % (w, h, x, y))
        self._bar_w = w

    def _on_resize_start(self, event, mode):
        self._resizing = True
        self._resize_mode = mode
        self._resize_start_x = event.x_root
        self._resize_start_y = event.y_root
        try:
            self._resize_start_w = self.win.winfo_width()
            self._resize_start_h = self.win.winfo_height()
            self._resize_start_win_x = self.win.winfo_x()
            self._resize_start_win_y = self.win.winfo_y()
        except Exception:
            self._resizing = False
            return
        self._paused = True

    def _on_resize_motion(self, event):
        if not getattr(self, "_resizing", False):
            return
        self._paused = True
        dx = event.x_root - self._resize_start_x
        dy = event.y_root - self._resize_start_y

        rect = wt.RECT()
        ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0)
        max_screen_w = (rect.right - rect.left) - 24
        max_screen_h = (rect.bottom - rect.top) - 24

        min_w, max_w = 240, max_screen_w
        min_h, max_h = 140, max_screen_h

        new_w = self._resize_start_w
        new_h = self._resize_start_h
        new_x = self._resize_start_win_x
        new_y = self._resize_start_win_y

        mode = getattr(self, "_resize_mode", "corner")
        pos = getattr(self, "_pos", "right")

        if mode in ("corner", "top"):
            target_h = self._resize_start_h - dy
            clamped_h = max(min_h, min(max_h, target_h))
            delta_h = clamped_h - self._resize_start_h
            new_h = clamped_h
            new_y = self._resize_start_win_y - delta_h

        if mode in ("corner", "side"):
            if pos == "left":
                target_w = self._resize_start_w + dx
                new_w = max(min_w, min(max_w, target_w))
            elif pos == "center":
                target_w = self._resize_start_w - dx
                clamped_w = max(min_w, min(max_w, target_w))
                delta_w = clamped_w - self._resize_start_w
                new_w = clamped_w
                new_x = self._resize_start_win_x - (delta_w // 2)
            else:
                target_w = self._resize_start_w - dx
                clamped_w = max(min_w, min(max_w, target_w))
                delta_w = clamped_w - self._resize_start_w
                new_w = clamped_w
                new_x = self._resize_start_win_x - delta_w

        try:
            self.win.geometry("%dx%d+%d+%d" % (new_w, new_h, new_x, new_y))
            self._bar_w = new_w
            frac = max(0.0, self._remaining / max(0.1, self.duration))
            self._bar.delete("all")
            self._bar.create_rectangle(0, 0, int(self._bar_w * frac), 3,
                                       fill=self.c["accent"], outline="")
            if hasattr(self, "tl"):
                self.tl.config(text="%d × %d px" % (new_w, new_h))
        except Exception:
            pass

    def _on_resize_end(self, event):
        if not getattr(self, "_resizing", False):
            return
        self._resizing = False
        self._paused = False
        if hasattr(self, "tl"):
            self.tl.config(text="البوب-أب السريع")
        try:
            w = max(240, self.win.winfo_width())
            h = max(140, self.win.winfo_height())
            self._save_custom_size(w, h)
        except Exception:
            pass

    def _save_custom_size(self, w, h):
        # ── تحديث الإعدادات في الذاكرة ──
        try:
            with self.settings._lock:
                self.settings.cfg["size"] = "custom"
                self.settings.cfg["custom_width"] = w
                self.settings.cfg["custom_height"] = h
        except Exception:
            pass

        # ── الحفظ المباشر في bg_config.json (الأساسي) ──
        def _write_file():
            try:
                cfg_path = os.path.join(ROOT, "bg_config.json")
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                except Exception:
                    cfg = {}
                cfg["size"] = "custom"
                cfg["custom_width"] = w
                cfg["custom_height"] = h
                with open(cfg_path, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)
                _log("تم حفظ المقاس المخصص في الملف: %dx%d" % (w, h))
            except Exception as e:
                _log("تعذر كتابة المقاس في الملف: " + repr(e)[:80])

            # ── مزامنة مع السيرفر (ثانوي) ──
            try:
                payload = json.dumps({
                    "size": "custom",
                    "custom_width": w,
                    "custom_height": h,
                }, ensure_ascii=False).encode("utf-8")
                req = urllib.request.Request(BG_URL, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=3) as r:
                    pass
            except Exception:
                pass

        threading.Thread(target=_write_file, daemon=True).start()

    def _render_theme_icon(self, hover=False):
        try:
            color = getattr(self, "color", "dark")
            fg = self.c["accent"] if hover else self.c["muted"]
            bg = self.c["card"]
            self.btn_theme_canvas.configure(bg=bg)
            self.btn_theme_canvas.delete("all")
            if color == "dark":
                # Vector Sun: central circle + 8 clean radiating rays (no emoji)
                self.btn_theme_canvas.create_oval(6, 6, 14, 14, outline=fg, width=1.5)
                self.btn_theme_canvas.create_line(10, 1, 10, 4, fill=fg, width=1.5, capstyle="round")
                self.btn_theme_canvas.create_line(10, 16, 10, 19, fill=fg, width=1.5, capstyle="round")
                self.btn_theme_canvas.create_line(1, 10, 4, 10, fill=fg, width=1.5, capstyle="round")
                self.btn_theme_canvas.create_line(16, 10, 19, 10, fill=fg, width=1.5, capstyle="round")
                self.btn_theme_canvas.create_line(3.5, 3.5, 5.8, 5.8, fill=fg, width=1.5, capstyle="round")
                self.btn_theme_canvas.create_line(14.2, 14.2, 16.5, 16.5, fill=fg, width=1.5, capstyle="round")
                self.btn_theme_canvas.create_line(16.5, 3.5, 14.2, 5.8, fill=fg, width=1.5, capstyle="round")
                self.btn_theme_canvas.create_line(5.8, 14.2, 3.5, 16.5, fill=fg, width=1.5, capstyle="round")
            else:
                # Vector Moon: smooth crescent moon (no emoji)
                self.btn_theme_canvas.create_oval(3, 3, 17, 17, fill=fg, outline="")
                self.btn_theme_canvas.create_oval(7, 1, 19, 15, fill=bg, outline="")
        except Exception:
            pass

    def _toggle_theme(self):
        new_color = "light" if getattr(self, "color", "dark") == "dark" else "dark"
        self.color = new_color
        self.c = COLORS_DARK if new_color == "dark" else COLORS_LIGHT

        try:
            self.win.configure(bg=self.c["card"])
            if hasattr(self, "top_edge"):
                self.top_edge.configure(bg=self.c["card"])
            if hasattr(self, "side_edge"):
                self.side_edge.configure(bg=self.c["card"])
            if hasattr(self, "head"):
                self.head.configure(bg=self.c["card"])
            if hasattr(self, "btn_resize"):
                self.btn_resize.configure(bg=self.c["card"], fg=self.c["muted"])
            if hasattr(self, "dot"):
                self.dot.configure(bg=self.c["card"], fg=self.c["accent"])
            if hasattr(self, "tl"):
                self.tl.configure(bg=self.c["card"], fg=self.c["muted"])
            if hasattr(self, "btn_copy"):
                self.btn_copy.configure(bg=self.c["card"], fg=self.c["fg"])
            if hasattr(self, "btn_close"):
                self.btn_close.configure(bg=self.c["card"], fg=self.c["err"])
            if hasattr(self, "body"):
                self.body.configure(bg=self.c["card"], fg=self.c["fg"])
            if hasattr(self, "_bar"):
                self._bar.configure(bg=self.c["bg"])
                frac = max(0.0, self._remaining / max(0.1, self.duration))
                self._bar.delete("all")
                self._bar.create_rectangle(0, 0, int(self._bar_w * frac), 3,
                                           fill=self.c["accent"], outline="")
            self._render_theme_icon(hover=True)
        except Exception:
            pass

        try:
            with self.settings._lock:
                self.settings.cfg["color"] = new_color
        except Exception:
            pass

        def _post():
            try:
                cfg_path = os.path.join(ROOT, "bg_config.json")
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                except Exception:
                    cfg = {}
                cfg["color"] = new_color
                with open(cfg_path, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)
                _log("تم تبديل ثيم النافذة إلى: " + new_color)
            except Exception as e:
                _log("تعذر حفظ ثيم النافذة في الملف: " + repr(e)[:60])
            try:
                payload = json.dumps({"color": new_color}, ensure_ascii=False).encode("utf-8")
                req = urllib.request.Request(BG_URL, data=payload, headers={"Content-Type": "application/json"})
                with urllib.request.urlopen(req, timeout=3) as r:
                    pass
            except Exception:
                pass

        threading.Thread(target=_post, daemon=True).start()

    # ── سحب وتحريك النافذة إلى أي مكان في الشاشة ──
    def _on_move_start(self, event):
        self._moving = True
        self._move_start_x = event.x_root
        self._move_start_y = event.y_root
        try:
            self._move_win_x = self.win.winfo_x()
            self._move_win_y = self.win.winfo_y()
        except Exception:
            self._moving = False

    def _on_move_motion(self, event):
        if not getattr(self, "_moving", False):
            return
        dx = event.x_root - self._move_start_x
        dy = event.y_root - self._move_start_y
        new_x = self._move_win_x + dx
        new_y = self._move_win_y + dy
        try:
            self.win.geometry("+%d+%d" % (new_x, new_y))
        except Exception:
            pass

    def _on_move_end(self, event):
        self._moving = False
        # حفظ الموضع الجديد في bg_config.json
        try:
            x = self.win.winfo_x()
            y = self.win.winfo_y()
            self._save_position(x, y)
        except Exception:
            pass

    def _save_position(self, x, y):
        # تحديث الإعدادات في الذاكرة
        try:
            with self.settings._lock:
                self.settings.cfg["custom_x"] = x
                self.settings.cfg["custom_y"] = y
        except Exception:
            pass

        # كتابة مباشرة في bg_config.json
        def _write():
            try:
                cfg_path = os.path.join(ROOT, "bg_config.json")
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                except Exception:
                    cfg = {}
                cfg["custom_x"] = x
                cfg["custom_y"] = y
                with open(cfg_path, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)
                _log("تم حفظ موضع النافذة: x=%d, y=%d" % (x, y))
            except Exception as e:
                _log("تعذر حفظ الموضع: " + repr(e)[:60])

        threading.Thread(target=_write, daemon=True).start()

    def _on_opacity_change(self, val):
        """يُستدعى فور تحريك شريط الشفافية."""
        try:
            v = max(0.2, min(1.0, int(val) / 100.0))
            self._opacity = v
            self.win.attributes("-alpha", v)
        except Exception:
            pass
        # نحفظ بعد 400ms لتجنب الكتابة المتكررة أثناء السحب
        if getattr(self, "_opacity_after_id", None):
            try:
                self.win.after_cancel(self._opacity_after_id)
            except Exception:
                pass
        self._opacity_after_id = self.win.after(
            400, lambda: self._save_opacity(self._opacity)
        )

    def _save_opacity(self, v):
        # تحديث في الذاكرة
        try:
            with self.settings._lock:
                self.settings.cfg["opacity"] = v
        except Exception:
            pass

        # كتابة مباشرة في bg_config.json
        def _write():
            try:
                cfg_path = os.path.join(ROOT, "bg_config.json")
                try:
                    with open(cfg_path, "r", encoding="utf-8") as f:
                        cfg = json.load(f)
                except Exception:
                    cfg = {}
                cfg["opacity"] = v
                with open(cfg_path, "w", encoding="utf-8") as f:
                    json.dump(cfg, f, ensure_ascii=False, indent=2)
                _log("تم حفظ شفافية النافذة: %.0f%%" % (v * 100))
            except Exception as e:
                _log("تعذر حفظ الشفافية: " + repr(e)[:60])

        threading.Thread(target=_write, daemon=True).start()

    def _set_pause(self, paused):
        self._paused = paused

    def _tick(self):
        if self._cancel:
            return
        if not self._paused and not getattr(self, "_resizing", False):
            self._remaining -= 0.1
            frac = max(0.0, self._remaining / max(0.1, self.duration))
            self._bar.delete("all")
            self._bar.create_rectangle(0, 0, int(self._bar_w * frac), 3,
                                       fill=self.c["accent"], outline="")
            if self._remaining <= 0.001:
                self.exit()
                return
        self.win.after(100, self._tick)

    def _do_copy(self, answer):
        # استخدام Tkinter clipboard مباشرة (نفس thread الـ Tk) لتجنب تعارض ملكية الحافظة
        try:
            self.root.clipboard_clear()
            self.root.clipboard_append(answer)
            self.root.update()   # يُثبّت ملكية الـ clipboard
            _log("تم نسخ الإجابة إلى الحافظة")
        except Exception as e:
            _log("تعذر النسخ عبر Tk: " + repr(e)[:60])
            # fallback: ctypes
            try:
                clip_set_text(answer)
            except Exception:
                pass

        # تغذية بصرية: تغيير نص الزر لـ "✓ تم" ثم الرجوع
        try:
            self.btn_copy.config(text="✓ تم", fg=self.c["accent"])
            self.win.after(1500, lambda: (
                self.btn_copy.config(text="نسخ", fg=self.c["fg"])
                if not self._cancel else None
            ))
        except Exception:
            pass

        if self.on_copy:
            self.on_copy()

    def exit(self):
        self._cancel = True
        try:
            self.win.destroy()
        except Exception:
            pass


class TkLoop:
    def __init__(self, qbox, settings, last_ref):
        self.q = qbox
        self.settings = settings
        self.last = last_ref
        self.root = None
        self.current = None

    def run(self):
        self.root = tk.Tk()
        self.root.withdraw()
        self.root.after(60, self._poll)
        self.root.mainloop()

    def _poll(self):
        try:
            item = self.q.get_nowait()
        except queue.Empty:
            item = None
        if item:
            kind = item.get("kind")
            if kind == "exit":
                try:
                    self.root.destroy()
                except Exception:
                    pass
                return
            if kind == "toast":
                if self.current is not None:
                    self.current.exit()
                self.current = QuickToast(
                    self.root, item.get("text", ""), self.settings,
                    lambda: None,
                )
                _log("عرض التوست: " + (item.get("text") or "")[:40])
        try:
            slot = _q_clip.get_nowait()
            try:
                slot["val"] = self.root.clipboard_get()
            except Exception:
                slot["val"] = None
            slot["ev"].set()
        except queue.Empty:
            pass
        self.root.after(60, self._poll)


# ── نافذة الرسائل الخفية + اختصارات السجل ──
WNDPROC = ctypes.WINFUNCTYPE(ctypes.c_longlong, ctypes.c_void_p, wt.UINT, wt.WPARAM, wt.LPARAM)
_bg_state = {}

ctypes.windll.user32.DefWindowProcW.restype = ctypes.c_longlong
ctypes.windll.user32.DefWindowProcW.argtypes = [ctypes.c_void_p, wt.UINT, wt.WPARAM, wt.LPARAM]
ctypes.windll.user32.CreateWindowExW.restype = ctypes.c_void_p
ctypes.windll.user32.CreateWindowExW.argtypes = [
    wt.DWORD, wt.LPCWSTR, wt.LPCWSTR, wt.DWORD, ctypes.c_int, ctypes.c_int,
    ctypes.c_int, ctypes.c_int, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p,
]
ctypes.windll.user32.RegisterHotKey.argtypes = [ctypes.c_void_p, ctypes.c_int, wt.UINT, wt.UINT]
ctypes.windll.user32.UnregisterHotKey.argtypes = [ctypes.c_void_p, ctypes.c_int]


class _WNDCLASSEXW(ctypes.Structure):
    _fields_ = [
        ("cbSize", wt.UINT), ("style", wt.UINT), ("lpfnWndProc", WNDPROC),
        ("cbClsExtra", ctypes.c_int), ("cbWndExtra", ctypes.c_int),
        ("hInstance", wt.HINSTANCE), ("hIcon", wt.HICON), ("hCursor", ctypes.c_void_p),
        ("hbrBackground", ctypes.c_void_p), ("lpszMenuName", wt.LPCWSTR),
        ("lpszClassName", wt.LPCWSTR), ("hIconSm", wt.HICON),
    ]


def _wnd_proc(hwnd, msg, wp, lp):
    st = _bg_state
    if msg == 0x0312:  # WM_HOTKEY
        if wp == HS_GENERATE:
            st["on_generate"]()
        elif wp == HS_REOPEN:
            st["on_reopen"]()
        return 0
    if msg == 0x0113:  # WM_TIMER
        st["on_refresh"]()
        return 0
    if msg == 0x0010:  # WM_DESTROY
        ctypes.windll.user32.PostQuitMessage(0)
        return 0
    return ctypes.windll.user32.DefWindowProcW(hwnd, msg, wp, lp)


def make_hidden_window():
    st = _bg_state
    wc = _WNDCLASSEXW()
    hInst = ctypes.windll.kernel32.GetModuleHandleW(None)
    className = wt.LPCWSTR("MadaQuickPopupMsgWin")
    wc.cbSize = ctypes.sizeof(_WNDCLASSEXW)
    wc.lpfnWndProc = WNDPROC(_wnd_proc)
    wc.hInstance = hInst
    wc.lpszClassName = className
    st["wc"] = wc
    ctypes.windll.user32.RegisterClassExW(ctypes.byref(wc))
    hwnd = ctypes.windll.user32.CreateWindowExW(
        0, className, className, 0, 0, 0, 0, 0,
        ctypes.c_void_p(HWND_MESSAGE), None, hInst, None)
    st["hwnd"] = hwnd
    return hwnd


def register_hotkey(hwnd, hid, mods, vk):
    if not mods or not vk:
        return False
    ok = ctypes.windll.user32.RegisterHotKey(hwnd, hid, mods, vk)
    return bool(ok)


def unregister_hotkey(hwnd, hid):
    try:
        ctypes.windll.user32.UnregisterHotKey(hwnd, hid)
    except Exception:
        pass


# ── المنطق الرئيسي ──
def build_toast_dict(text, err=False):
    return {"kind": "toast", "text": text, "iserr": err}


def main():
    # الصلاحية تأتي من الخادم: إن شُغّل الخادم كمسؤول ورث الوكيلُ والنافذةُ الصلاحية
    # فتظهر فوق أي تطبيق (حتى المرفوع). وإلا عمل كالمعتاد فوق التطبيقات العادية.
    _pid_write()

    settings = Settings()
    st = _bg_state
    q_ui = queue.Queue()
    last = {"answer": ""}

    # تهيئة tk في خيط منفصل
    tk_th = threading.Thread(target=lambda: TkLoop(q_ui, settings, last).run(), daemon=True)
    tk_th.start()

    # انتظار جاهزية السيرفر عند الإقلاع
    for _ in range(20):
        if settings.load():
            break
        time.sleep(0.5)

    # لو أُطفئ من البداية
    if settings.get("enabled", True) is False:
        _pid_clear()
        q_ui.put({"kind": "exit"})
        return

    hwnd = make_hidden_window()
    if not hwnd:
        _log("فشل إنشاء نافذة الرسائل")
        _pid_clear()
        q_ui.put({"kind": "exit"})
        return

    def apply_hotkeys():
        unregister_hotkey(hwnd, HS_GENERATE)
        unregister_hotkey(hwnd, HS_REOPEN)
        g = parse_hotkey(settings.get("hotkey", ""))
        r = parse_hotkey(settings.get("reopen_hotkey", ""))
        fails = set()
        if g:
            if not register_hotkey(hwnd, HS_GENERATE, g[0], g[1]):
                fails.add(HS_GENERATE)
            else:
                _log("تم تفعيل اختصار التوليد: " + (settings.get("hotkey", "") or "-"))
        if r:
            if not register_hotkey(hwnd, HS_REOPEN, r[0], r[1]):
                fails.add(HS_REOPEN)
            else:
                _log("تم تفعيل اختصار إعادة الفتح: " + (settings.get("reopen_hotkey", "") or "-"))
        st["hk_fail"] = fails
        st["hi"] = (settings.get("hotkey", ""), settings.get("reopen_hotkey", ""))
        for hid, label in ((HS_GENERATE, settings.get("hotkey", "")), (HS_REOPEN, settings.get("reopen_hotkey", ""))):
            if hid in fails and hid not in st.get("hk_logged", set()):
                _log("تعذر تسجيل الاختصار: " + (label or "-"))
        st["hk_logged"] = fails

    def on_generate():
        _log("اختصار التوليد مضغوط")
        threading.Thread(target=generate_worker, daemon=True).start()

    def generate_worker():
        try:
            if settings.load():
                pass  # إعادة تسجيل الاختصارات تتم حصراً في خيط الرسائل (on_refresh) لمنع السباقات
            text = capture_selection()
            if text is None:
                _log("لا يوجد نص محدد في الحافظة")
                q_ui.put(build_toast_dict("لم يتم تحديد أي نص", err=True))
                return
            _log("التقط النص: %d حرف" % len(text))
            answer, err = post_quick(text, settings)
            if answer:
                last["answer"] = answer
                _log("تم التوليد: " + answer[:40])
                q_ui.put(build_toast_dict(answer))
            else:
                _log("فشل الجيل: " + (err or "تعذر توليد الرد")[:60])
                q_ui.put(build_toast_dict(err or "تعذر توليد الرد", err=True))
        except Exception as e:
            _log("خطأ في التوليد: " + repr(e)[:80])

    def on_reopen():
        if last.get("answer"):
            q_ui.put(build_toast_dict(last["answer"]))
        else:
            q_ui.put(build_toast_dict("لا يوجد رد سابق", err=True))

    def on_refresh():
        _pid_write()
        if settings.load():
            hi = st.get("hi")
            cur = (settings.get("hotkey", ""), settings.get("reopen_hotkey", ""))
            # تحديث الاختصارات فقط عند تغييرها من الإعدادات لمنع التكرار المزعج
            if hi != cur:
                apply_hotkeys()
            if settings.get("enabled", True) is False:
                _log("تم إيقاف البوب-أب من الإعدادات")
                _pid_clear()
                q_ui.put({"kind": "exit"})
                ctypes.windll.user32.PostQuitMessage(0)
            elif settings.fail_streak >= 12:  # ~24 ثانية بلا خادم
                _pid_clear()
                q_ui.put({"kind": "exit"})
                ctypes.windll.user32.PostQuitMessage(0)

    st["on_generate"] = on_generate
    st["on_reopen"] = on_reopen
    st["on_refresh"] = on_refresh
    apply_hotkeys()
    ctypes.windll.user32.SetTimer(hwnd, TIMER_REFRESH, 2000, None)

    _log("الوكيل جاهز: " + (settings.get("hotkey", "") or "-"))

    msg = wt.MSG()
    while ctypes.windll.user32.GetMessageW(ctypes.byref(msg), None, 0, 0) != 0:
        ctypes.windll.user32.TranslateMessage(ctypes.byref(msg))
        ctypes.windll.user32.DispatchMessageW(ctypes.byref(msg))

    try:
        ctypes.windll.user32.KillTimer(hwnd, TIMER_REFRESH)
    except Exception:
        pass


if __name__ == "__main__":
    main()
