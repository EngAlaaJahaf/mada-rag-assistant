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

ROOT = os.path.dirname(os.path.abspath(__file__))
BG_URL = "http://127.0.0.1:8787/api/bg"
QUICK_URL = "http://127.0.0.1:8787/api/quick"
LOG_PATH = os.path.join(ROOT, "bg_agent.log")

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
    if not ctypes.windll.user32.OpenClipboard(None):
        return None
    try:
        if not ctypes.windll.user32.IsClipboardFormatAvailable(CF_UNICODETEXT):
            return None
        h = ctypes.windll.user32.GetClipboardData(CF_UNICODETEXT)
        if not h:
            return None
        ptr = ctypes.windll.kernel32.GlobalLock(h)
        try:
            return ctypes.wstring_at(ptr)
        finally:
            ctypes.windll.kernel32.GlobalUnlock(h)
    finally:
        ctypes.windll.user32.CloseClipboard()


def clip_set_text(t):
    payload = (t or "").encode("utf-16-le") + b"\x00\x00"
    h = ctypes.windll.kernel32.GlobalAlloc(0x0042, len(payload))
    if not h:
        return
    ptr = ctypes.windll.kernel32.GlobalLock(h)
    ctypes.memmove(ptr, payload, len(payload))
    ctypes.windll.kernel32.GlobalUnlock(h)
    ctypes.windll.user32.OpenClipboard(None)
    try:
        ctypes.windll.user32.EmptyClipboard()
        ctypes.windll.user32.SetClipboardData(CF_UNICODETEXT, h)
    finally:
        ctypes.windll.user32.CloseClipboard()


def clip_clear():
    ctypes.windll.user32.OpenClipboard(None)
    try:
        ctypes.windll.user32.EmptyClipboard()
    finally:
        ctypes.windll.user32.CloseClipboard()


def clip_sequence():
    return ctypes.windll.user32.GetClipboardSequenceNumber()


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
    arr = (_INPUT * 4)(
        _key_event(0x11, 0), _key_event(ord("C"), 0),
        _key_event(ord("C"), 2), _key_event(0x11, 2),
    )
    try:
        return ctypes.windll.user32.SendInput(4, ctypes.byref(arr), ctypes.sizeof(_INPUT))
    except Exception:
        return 0


def capture_selection():
    """نسخ آمن: Ctrl+C للنافذة النشطة + قراءة + استعادة الحافظة."""
    before = clip_get_text()
    has_before = before is not None
    seq0 = clip_sequence()
    send_ctrl_c()
    deadline = time.time() + 1.0
    selected = None
    while time.time() < deadline:
        if clip_sequence() != seq0:
            break
        time.sleep(0.01)
    selected = clip_get_text()
    if has_before:
        clip_set_text(before)
    else:
        clip_clear()
    return selected if (selected and selected.strip()) else None


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
        try:
            with urllib.request.urlopen(BG_URL, timeout=4) as r:
                data = json.loads(r.read().decode("utf-8")) or {}
            with self._lock:
                self.cfg = data.get("settings", {}) or {}
            self.fail_streak = 0
            return True
        except Exception:
            self.fail_streak += 1
            return False


def post_quick(text, settings):
    payload = json.dumps({"text": text}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(QUICK_URL, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
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
        self.duration = float(settings.get("duration", 3) or 3)
        self._remaining = self.duration
        self._paused = False
        self._cancel = False
        color = settings.get("color", "dark")
        self.c = COLORS_DARK if color == "dark" else COLORS_LIGHT
        size = SIZES.get(settings.get("size", "medium"), 420)
        pos = settings.get("position", "bottom-right")

        self.win = tk.Toplevel(root)
        self.win.withdraw()
        self.win.overrideredirect(True)
        self.win.attributes("-topmost", True)
        self.win.configure(bg=self.c["card"])

        head = tk.Frame(self.win, bg=self.c["card"], padx=10, pady=6)
        head.pack(fill="x")
        dot = tk.Label(head, text="●", fg=self.c["accent"], bg=self.c["card"], font=("Segoe UI", 9))
        dot.pack(side="left")
        tl = tk.Label(head, text="البوب-أب السريع", fg=self.c["muted"], bg=self.c["card"],
                      font=("Segoe UI", 9, "bold"))
        tl.pack(side="left", padx=(6, 0))
        btn_copy = tk.Label(head, text="📋 نسخ", fg=self.c["fg"], bg=self.c["card"],
                            cursor="hand2", font=("Segoe UI", 9))
        btn_copy.pack(side="right", padx=(0, 8))
        btn_close = tk.Label(head, text="✕", fg=self.c["err"], bg=self.c["card"],
                             cursor="hand2", font=("Segoe UI", 10, "bold"))
        btn_close.pack(side="right")
        btn_copy.bind("<Button-1>", lambda e: self._do_copy(answer))
        btn_close.bind("<Button-1>", lambda e: self.exit())

        body = tk.Text(self.win, bg=self.c["card"], fg=self.c["fg"], relief="flat",
                       font=("Segoe UI", 11), wrap="word", height=6, padx=10, pady=8,
                       cursor="arrow", highlightthickness=0, borderwidth=0)
        body.pack(fill="both", expand=True)
        body.insert("1.0", answer)
        body.configure(state="disabled")

        self._bar = tk.Canvas(self.win, height=3, bg=self.c["bg"], highlightthickness=0)
        self._bar.pack(fill="x")
        self._bar_w = size

        self.win.bind("<Enter>", lambda e: self._set_pause(True))
        self.win.bind("<Leave>", lambda e: self._set_pause(False))
        self.win.bind("<Button-1>", lambda e: self._set_pause(True))

        self._place(pos, size)
        self.win.deiconify()
        self._tick()

    def _place(self, pos, width):
        rect = wt.RECT()
        ctypes.windll.user32.SystemParametersInfoW(0x0030, 0, ctypes.byref(rect), 0)
        h = min(320, rect.bottom - rect.top - 24)
        w = min(width, rect.right - rect.left - 24)
        if pos == "left":
            x = rect.left + 12
        elif pos == "center":
            x = (rect.left + rect.right - w) // 2
        else:
            x = rect.right - w - 12
        y = rect.bottom - h - 12
        self.win.geometry("%dx%d+%d+%d" % (w, h, x, y))
        self._bar_w = w

    def _set_pause(self, paused):
        self._paused = paused

    def _tick(self):
        if self._cancel:
            return
        if not self._paused:
            self._remaining -= 0.1
            frac = max(0.0, self._remaining / max(0.1, self.duration))
            self._bar.delete("all")
            self._bar.create_rectangle(0, 0, int(self._bar_w * frac), 3,
                                       fill=self.c["accent"], outline="")
            if self._remaining <= 0:
                self.exit()
                return
        self.win.after(100, self._tick)

    def _do_copy(self, answer):
        try:
            clip_set_text(answer)
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
        q_ui.put({"kind": "exit"})
        return

    hwnd = make_hidden_window()
    if not hwnd:
        _log("فشل إنشاء نافذة الرسائل")
        q_ui.put({"kind": "exit"})
        return

    def apply_hotkeys():
        unregister_hotkey(hwnd, HS_GENERATE)
        unregister_hotkey(hwnd, HS_REOPEN)
        g = parse_hotkey(settings.get("hotkey", ""))
        r = parse_hotkey(settings.get("reopen_hotkey", ""))
        if g:
            if not register_hotkey(hwnd, HS_GENERATE, g[0], g[1]):
                _log("تعذر تسجيل الاختصار: " + (settings.get("hotkey", "") or "-"))
        if r:
            if not register_hotkey(hwnd, HS_REOPEN, r[0], r[1]):
                _log("تعذر تسجيل الاختصار: " + (settings.get("reopen_hotkey", "") or "-"))
        st["hi"] = (settings.get("hotkey", ""), settings.get("reopen_hotkey", ""))

    def on_generate():
        threading.Thread(target=generate_worker, daemon=True).start()

    def generate_worker():
        if settings.load():
            apply_hotkeys()
        text = capture_selection()
        if text is None:
            q_ui.put(build_toast_dict("لم يتم تحديد أي نص", err=True))
            return
        answer, err = post_quick(text, settings)
        if answer:
            last["answer"] = answer
            q_ui.put(build_toast_dict(answer))
        else:
            q_ui.put(build_toast_dict(err or "تعذر توليد الرد", err=True))

    def on_reopen():
        if last.get("answer"):
            q_ui.put(build_toast_dict(last["answer"]))
        else:
            q_ui.put(build_toast_dict("لا يوجد رد سابق", err=True))

    def on_refresh():
        if settings.load():
            hi = st.get("hi")
            cur = (settings.get("hotkey", ""), settings.get("reopen_hotkey", ""))
            if hi != cur:
                apply_hotkeys()
            if settings.get("enabled", True) is False:
                _log("تم إيقاف البوب-أب من الإعدادات")
                q_ui.put({"kind": "exit"})
                ctypes.windll.user32.PostQuitMessage(0)
            elif settings.fail_streak >= 12:  # ~24 ثانية بلا خادم
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