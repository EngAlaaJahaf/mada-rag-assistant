# -*- coding: utf-8 -*-
"""
محرك استخراج النصوص (OCR Bridge) لمساعد مَدى RAG.
ملحق مستقل يعمل عبر Command-Line Interface ويخرج النتائج بصيغة JSON.
يدعم ملفات الصور (PNG, JPG, JPEG, BMP, TIFF, WEBP) وملفات PDF الممسوحة ضوئياً.
"""

import re
import os
import sys
import json
import time
import shutil
import argparse
import subprocess
import tempfile
from pathlib import Path

# ضبط مخرجات المحرف لتكون UTF-8 دائمًا
for _stream in (sys.stdout, sys.stderr):
    if _stream is not None:
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

SCRIPT_DIR = Path(__file__).resolve().parent

# محاولة استيراد المكتبات الاختيارية الخاصة بالـ OCR
try:
    from PIL import Image, ImageOps, ImageFilter
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

try:
    import pymupdf
    HAS_PYMUPDF = True
except ImportError:
    try:
        import fitz as pymupdf
        HAS_PYMUPDF = True
    except ImportError:
        HAS_PYMUPDF = False

try:
    import bidi.algorithm as bidi_algo
    HAS_BIDI = True
except ImportError:
    HAS_BIDI = False


def find_tesseract():
    """البحث الذكي عن مشغل tesseract ومجلد tessdata في المسارات القياسية والمحمولة."""
    candidates = [
        SCRIPT_DIR / "tesseract" / "tesseract.exe",
        Path(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tesseract.exe")),
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
    ]
    which_path = shutil.which("tesseract")
    if which_path:
        candidates.append(Path(which_path))

    exe_found = None
    for c in candidates:
        if c.is_file():
            exe_found = str(c)
            break

    if not exe_found:
        return None, None, []

    # البحث عن tessdata
    tessdata_candidates = [
        Path(exe_found).parent / "tessdata",
        SCRIPT_DIR / "tesseract" / "tessdata",
        Path(os.path.expandvars(r"%LOCALAPPDATA%\Programs\Tesseract-OCR\tessdata")),
        Path(r"C:\Program Files\Tesseract-OCR\tessdata"),
    ]
    data_found = None
    for td in tessdata_candidates:
        if td.is_dir():
            data_found = str(td)
            break

    languages = []
    if data_found and os.path.isdir(data_found):
        try:
            for f in os.listdir(data_found):
                if f.endswith(".traineddata"):
                    languages.append(f[:-12])
        except Exception:
            pass

    return exe_found, data_found, sorted(languages)


def fix_arabic_bidi(text):
    """تصحيح اتجاه النصوص العربية الناتجة عن محرك Tesseract من الترتيب المرئي (Visual) إلى المنطقي (Logical)."""
    if not text or not any("\u0600" <= c <= "\u06FF" for c in text):
        return text

    if HAS_BIDI:
        lines = text.splitlines()
        fixed_lines = []
        for line in lines:
            if any("\u0600" <= c <= "\u06FF" for c in line):
                try:
                    fixed_lines.append(bidi_algo.get_display(line))
                except Exception:
                    fixed_lines.append(line)
            else:
                fixed_lines.append(line)
        return "\n".join(fixed_lines)

    # طريقة بديلة في حال غياب مكتبة bidi: عكس الكلمات العربية مفردة
    lines = text.splitlines()
    fixed_lines = []
    for line in lines:
        words = line.split()
        fixed_words = []
        for w in words:
            if any("\u0600" <= c <= "\u06FF" for c in w):
                fixed_words.append(w[::-1])
            else:
                fixed_words.append(w)
        fixed_lines.append(" ".join(fixed_words[::-1]))
    return "\n".join(fixed_lines)


def clean_ocr_text(text):
    """تنظيف النصوص المستخرجة وحذف شوائب الرموز والأيقونات المعزولة."""
    if not text:
        return ""
    lines = []
    for line in text.splitlines():
        l_str = line.strip()
        # استبعاد الأسطر الفارغة أو الأسطر المكونة فقط من رموز خاصة وأقواس
        if not l_str or re.fullmatch(r"[\W_]+", l_str):
            continue
        lines.append(l_str)
    return "\n\n".join(lines)


def preprocess_image_for_ocr(img_path, output_path):
    """تحسين الصورة لزيادة دقة استخراج النص العربي دون تشويه الخطوط."""
    if not HAS_PIL:
        shutil.copyfile(img_path, output_path)
        return

    with Image.open(img_path) as img:
        # معالجة الشفافية للأيقونات ولقطات الشاشة الشفافة ودمجها مع خلفية بيضاء
        if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
            bg = Image.new("RGB", img.size, (255, 255, 255))
            if img.mode != "RGBA":
                img = img.convert("RGBA")
            bg.paste(img, mask=img.split()[3])
            img = bg
        else:
            img = img.convert("RGB")

        # تحويل للصورة الرمادية Grayscale مع تعزيز التباين
        gray = ImageOps.autocontrast(img.convert("L"), cutoff=1)
        gray.save(output_path, dpi=(300, 300))


def run_tesseract_on_image(img_path, tess_exe, tess_data, lang="ara+eng", psm=3):
    """تشغيل Tesseract على ملف صورة محدد واستخراج النص."""
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
        tmp_img = tmp_file.name

    try:
        preprocess_image_for_ocr(img_path, tmp_img)

        env = os.environ.copy()
        if tess_data:
            env["TESSDATA_PREFIX"] = tess_data

        cmd = [
            tess_exe,
            tmp_img,
            "stdout",
            "-l", lang,
            "--psm", str(psm),
        ]

        creation_flags = getattr(subprocess, "CREATE_NO_WINDOW", 0)
        res = subprocess.run(
            cmd,
            capture_output=True,
            timeout=90,
            creationflags=creation_flags,
            env=env
        )

        raw_text = res.stdout.decode("utf-8", errors="replace").strip()
        cleaned = clean_ocr_text(raw_text)
        return True, cleaned, ""
    except subprocess.TimeoutExpired:
        return False, "", "تجاوزت مهلة معالجة الصورة (Timeout)"
    except Exception as e:
        return False, "", str(e)
    finally:
        if os.path.exists(tmp_img):
            try:
                os.remove(tmp_img)
            except Exception:
                pass


def process_pdf(pdf_path, tess_exe, tess_data, lang="ara+eng", dpi=300):
    """معالجة ملف PDF: استخراج النص الرقمي الأصلي إن وُجد، وتطبيق OCR على الصفحات الممسوحة ضوئياً فقط."""
    if not HAS_PYMUPDF:
        return False, [], "مكتبة pymupdf غير متوفرة لمعالجة ملفات PDF"

    pages = []
    try:
        doc = pymupdf.open(pdf_path)
    except Exception as e:
        return False, [], f"فشل فتح ملف PDF: {e}"

    temp_images = []
    try:
        for idx in range(len(doc)):
            page_num = idx + 1
            page = doc[idx]

            # الفحص السريع: هل الصفحة تحتوي أصلاً على نصوص رقمية مخزنة؟
            embedded_text = page.get_text().strip()
            # إذا وُجد نص كافٍ (أكثر من 25 حرفاً)، نعتمد النص الرقمي الفوري (سريع وبدون إجهاد المعالج)
            if len(embedded_text) >= 25:
                pages.append({
                    "page": page_num,
                    "text": embedded_text,
                    "source": "native"
                })
                continue

            # إذا كانت الصفحة ممسوحة ضوئياً (صورة بدون نص): نحولها لصورة 300 DPI ونشغل OCR
            mat = pymupdf.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat, colorspace=pymupdf.csGRAY)

            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_f:
                tmp_page_path = tmp_f.name
            temp_images.append(tmp_page_path)
            pix.save(tmp_page_path)

            ok, ocr_text, err = run_tesseract_on_image(tmp_page_path, tess_exe, tess_data, lang=lang)
            if ok and ocr_text:
                pages.append({
                    "page": page_num,
                    "text": ocr_text,
                    "source": "ocr"
                })
            elif embedded_text:
                # إذا فشل OCR ولكن وجدنا أي نص طفيف رقمي، نستخدمه كبديل
                pages.append({
                    "page": page_num,
                    "text": embedded_text,
                    "source": "native_partial"
                })
    finally:
        doc.close()
        for timg in temp_images:
            if os.path.exists(timg):
                try:
                    os.remove(timg)
                except Exception:
                    pass

    return True, pages, ""


def main():
    parser = argparse.ArgumentParser(description="Mada-RAG OCR Plugin CLI Bridge")
    parser.add_argument("--file", help="مسار الملف المراد قراءته")
    parser.add_argument("--lang", default="ara+eng", help="لغات المحرك (افتراضي: ara+eng)")
    parser.add_argument("--dpi", type=int, default=300, help="دقة تحويل PDF (افتراضي: 300)")
    parser.add_argument("--check", action="store_true", help="فحص توفر المحرك والمكتبات")

    args = parser.parse_args()

    tess_exe, tess_data, languages = find_tesseract()

    # وضع الفحص التشخيصي
    if args.check:
        out = {
            "ok": bool(tess_exe),
            "status": "ready" if tess_exe else "missing_engine",
            "tesseract_exe": tess_exe,
            "tessdata": tess_data,
            "languages": languages,
            "has_pil": HAS_PIL,
            "has_pymupdf": HAS_PYMUPDF,
            "has_bidi": HAS_BIDI,
            "arabic_supported": "ara" in languages
        }
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return

    if not args.file:
        print(json.dumps({"ok": False, "error": "مسار الملف مطلوب (--file)"}, ensure_ascii=False))
        sys.exit(1)

    file_path = Path(args.file).resolve()
    if not file_path.is_file():
        print(json.dumps({"ok": False, "error": f"الملف غير موجود: {args.file}"}, ensure_ascii=False))
        sys.exit(1)

    if not tess_exe:
        print(json.dumps({
            "ok": False,
            "error": "محرك Tesseract غير مثبت أو لم يُعثر على ملف التنفيذ",
            "error_code": "TESSERACT_NOT_FOUND"
        }, ensure_ascii=False))
        sys.exit(1)

    t0 = time.time()
    ext = file_path.suffix.lower()

    # معالجة الصور
    image_exts = {".png", ".jpg", ".jpeg", ".bmp", ".tiff", ".webp"}
    if ext in image_exts:
        ok, text, err = run_tesseract_on_image(str(file_path), tess_exe, tess_data, lang=args.lang)
        elapsed = round(time.time() - t0, 2)
        if ok:
            pages = [{"page": 1, "text": text, "source": "ocr"}] if text else []
            out = {
                "ok": True,
                "file": str(file_path),
                "pages": pages,
                "total_pages": 1,
                "elapsed_sec": elapsed,
                "engine": "Tesseract",
                "lang": args.lang
            }
        else:
            out = {"ok": False, "file": str(file_path), "error": err, "elapsed_sec": elapsed}
        print(json.dumps(out, ensure_ascii=False))
        return

    # معالجة PDF
    if ext == ".pdf":
        ok, pages, err = process_pdf(str(file_path), tess_exe, tess_data, lang=args.lang, dpi=args.dpi)
        elapsed = round(time.time() - t0, 2)
        if ok:
            out = {
                "ok": True,
                "file": str(file_path),
                "pages": pages,
                "total_pages": len(pages),
                "elapsed_sec": elapsed,
                "engine": "Tesseract+PyMuPDF",
                "lang": args.lang
            }
        else:
            out = {"ok": False, "file": str(file_path), "error": err, "elapsed_sec": elapsed}
        print(json.dumps(out, ensure_ascii=False))
        return

    print(json.dumps({"ok": False, "error": f"صيغة ملف غير مدعومة للـ OCR: {ext}"}, ensure_ascii=False))
    sys.exit(1)


if __name__ == "__main__":
    main()
