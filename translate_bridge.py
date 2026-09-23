# -*- coding: utf-8 -*-
"""جسر ترجمة إنجليزي->عربي لـ«مذكّرتي»: يعمل داخل الـvenv الخاص بـ LibreTranslate.
يقرأ أسطر JSON من stdin ويكتب النتائج إلى stdout.
"""
import sys
import io
import json

if hasattr(sys.stdout, "buffer"):
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8", errors="replace")
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

from argostranslate import translate

MAX_CHARS = 1200


def main():
    try:
        langs = translate.get_installed_languages()
        en = next(l for l in langs if l.code == "en")
        ar = next(l for l in langs if l.code == "ar")
        e2a = en.get_translation(ar)
        a2e = ar.get_translation(en)
    except Exception as e:
        sys.stdout.write(json.dumps({"ok": False, "err": "init:" + str(e)}, ensure_ascii=False) + "\n")
        sys.stdout.flush()
        sys.exit(1)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
            mid = msg.get("id")
            if msg.get("q") == "ping":
                out = {"id": mid, "ok": True, "ar": "pong"}
            else:
                txt = (msg.get("text") or "")[:MAX_CHARS]
                tr = e2a if msg.get("dir", "en2ar") == "en2ar" else a2e
                out = {"id": mid, "ok": True, "ar": tr.translate(txt)}
        except Exception as e:
            out = {"id": None, "ok": False, "err": str(e)}
        sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()