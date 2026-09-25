@echo off
chcp 65001 >nul
setlocal
title نسخ تطبيق مَدى إلى الفلاشة (Direct Fast Sync)
cd /d "%~dp0"

if not exist "%~dp0make-portable-usb.ps1" (
    echo [خطأ] لم يتم العثور على ملف make-portable-usb.ps1 بجوار هذا الملف.
    pause
    exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-portable-usb.ps1"
set "result=%errorlevel%"

echo.
if "%result%"=="0" (
    echo ==========================================================
    echo   اكتمل التجهيز! يمكنك الآن فصل الفلاشة وتشغيلها بأمان.
    echo ==========================================================
) else (
    echo ❌ فشلت عملية النسخ. يرجى مراجعة رسالة الخطأ أعلاه.
)

pause
exit /b %result%
