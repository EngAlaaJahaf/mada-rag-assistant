# -*- coding: utf-8 -*-
"""
أداة مساعدة لفتح متصفح ملفات ويندوز الأصلي (Native Windows Open File Dialog)
تضمن الظهور الفوري في الواجهة (TopMost) أمام متصفح الويب وجميع النوافذ.
"""
import sys
import os
import subprocess

for _s in (sys.stdout, sys.stderr):
    if _s is not None:
        try:
            _s.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def _pick_via_tkinter(kind="exe", initial_dir=None):
    try:
        import tkinter as tk
        from tkinter import filedialog

        root = tk.Tk()
        root.withdraw()
        # جعل النافذة دائمًا في المقدمة فوق جميع البرامج والمتصفح
        root.attributes("-topmost", True)
        root.focus_force()

        if kind == "exe":
            title = "اختر برنامج التشغيل llama-server.exe"
            filetypes = [
                ("ملفات البرامج التنفيذية (*.exe)", "*.exe"),
                ("جميع الملفات (*.*)", "*.*"),
            ]
        else:
            title = "اختر ملف النموذج (.gguf)"
            filetypes = [
                ("ملفات نماذج الذكاء الاصطناعي (*.gguf)", "*.gguf"),
                ("جميع الملفات (*.*)", "*.*"),
            ]

        init_dir = (
            initial_dir
            if (initial_dir and os.path.isdir(initial_dir))
            else (os.path.dirname(initial_dir) if (initial_dir and os.path.isfile(initial_dir)) else None)
        )

        chosen = filedialog.askopenfilename(
            parent=root,
            title=title,
            initialdir=init_dir,
            filetypes=filetypes,
        )
        root.destroy()

        if chosen and os.path.isfile(chosen):
            return os.path.normpath(chosen)
        return ""
    except Exception:
        return None


def _pick_via_win32(kind="exe", initial_dir=None):
    try:
        import ctypes
        from ctypes import wintypes

        class OPENFILENAMEW(ctypes.Structure):
            _fields_ = [
                ("lStructSize", wintypes.DWORD),
                ("hwndOwner", wintypes.HWND),
                ("hInstance", wintypes.HINSTANCE),
                ("lpstrFilter", wintypes.LPCWSTR),
                ("lpstrCustomFilter", wintypes.LPWSTR),
                ("nMaxCustFilter", wintypes.DWORD),
                ("nFilterIndex", wintypes.DWORD),
                ("lpstrFile", wintypes.LPWSTR),
                ("nMaxFile", wintypes.DWORD),
                ("lpstrFileTitle", wintypes.LPWSTR),
                ("nMaxFileTitle", wintypes.DWORD),
                ("lpstrInitialDir", wintypes.LPCWSTR),
                ("lpstrTitle", wintypes.LPCWSTR),
                ("Flags", wintypes.DWORD),
                ("nFileOffset", wintypes.WORD),
                ("nFileExtension", wintypes.WORD),
                ("lpstrDefExt", wintypes.LPCWSTR),
                ("lCustData", wintypes.LPARAM),
                ("lpfnHook", wintypes.LPVOID),
                ("lpTemplateName", wintypes.LPCWSTR),
                ("pvReserved", wintypes.LPVOID),
                ("dwReserved", wintypes.DWORD),
                ("FlagsEx", wintypes.DWORD),
            ]

        if kind == "exe":
            title = "اختر برنامج التشغيل llama-server.exe"
            filter_str = "برامج تنفيذية (*.exe)\0*.exe\0جميع الملفات (*.*)\0*.*\0\0"
        else:
            title = "اختر ملف النموذج (.gguf)"
            filter_str = "ملفات النماذج (*.gguf)\0*.gguf\0جميع الملفات (*.*)\0*.*\0\0"

        flt_buf = ctypes.create_unicode_buffer(filter_str)
        file_buf = ctypes.create_unicode_buffer(4096)

        ofn = OPENFILENAMEW()
        ofn.lStructSize = ctypes.sizeof(OPENFILENAMEW)

        user32 = ctypes.windll.user32
        try:
            user32.AllowSetForegroundWindow(-1)
        except Exception:
            pass

        hwnd = user32.GetForegroundWindow()
        ofn.hwndOwner = hwnd
        ofn.lpstrFilter = ctypes.cast(flt_buf, wintypes.LPCWSTR)
        ofn.lpstrFile = ctypes.cast(file_buf, wintypes.LPWSTR)
        ofn.nMaxFile = 4096
        ofn.lpstrTitle = title

        init_buf = None
        if initial_dir and os.path.isdir(initial_dir):
            init_buf = ctypes.create_unicode_buffer(initial_dir)
            ofn.lpstrInitialDir = ctypes.cast(init_buf, wintypes.LPCWSTR)

        # OFN_PATHMUSTEXIST (0x800) | OFN_FILEMUSTEXIST (0x1000) | OFN_EXPLORER (0x80000) | OFN_NOCHANGEDIR (0x8)
        ofn.Flags = 0x00081808

        ok = ctypes.windll.comdlg32.GetOpenFileNameW(ctypes.byref(ofn))
        if ok:
            chosen = file_buf.value
            if chosen and os.path.isfile(chosen):
                return os.path.normpath(chosen)
        return ""
    except Exception:
        return None


def _pick_via_powershell(kind="exe", initial_dir=None):
    try:
        flt = "Executables (*.exe)|*.exe|All Files (*.*)|*.*" if kind == "exe" else "Model Files (*.gguf)|*.gguf|All Files (*.*)|*.*"
        title = "اختر برنامج التشغيل llama-server.exe" if kind == "exe" else "اختر ملف النموذج (.gguf)"
        safe_title = title.replace("'", "''")
        safe_dir = (initial_dir or "").replace("'", "''")
        ps_code = (
            "$ErrorActionPreference = 'SilentlyContinue'; "
            "[System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms') | Out-Null; "
            "$f = New-Object System.Windows.Forms.OpenFileDialog; "
            f"$f.Title = '{safe_title}'; "
            f"$f.Filter = '{flt}'; "
            + (f"$f.InitialDirectory = '{safe_dir}'; " if safe_dir else "")
            + "$f.ShowHelp = $false; "
            "$top = New-Object System.Windows.Forms.Form; "
            "$top.TopMost = $true; "
            "$top.StartPosition = [System.Windows.Forms.FormStartPosition]::CenterScreen; "
            "if ($f.ShowDialog($top) -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.FileName }"
        )
        res = subprocess.run(
            ["powershell", "-NoProfile", "-Sta", "-Command", ps_code],
            capture_output=True,
            text=True,
            timeout=50,
        )
        out = (res.stdout or "").strip()
        if out and os.path.isfile(out):
            return os.path.normpath(out)
    except Exception:
        pass
    return None


def pick_native(kind="exe", initial_dir=None):
    # 1. Tkinter (أسرع وأدق وأكثر استقراراً في المقدمة TopMost)
    res = _pick_via_tkinter(kind, initial_dir)
    if res is not None:
        if res:
            print(res)
        return res

    # 2. Win32 ComDlg32
    res = _pick_via_win32(kind, initial_dir)
    if res is not None:
        if res:
            print(res)
        return res

    # 3. PowerShell STA
    res = _pick_via_powershell(kind, initial_dir)
    if res:
        print(res)
        return res

    return None


if __name__ == "__main__":
    k = sys.argv[1] if len(sys.argv) > 1 else "exe"
    d = sys.argv[2] if len(sys.argv) > 2 else ""
    pick_native(k, d)
