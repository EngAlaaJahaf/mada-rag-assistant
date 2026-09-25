@echo off
setlocal
title Copy mada-rag to USB
cd /d "%~dp0"
if not exist "%~dp0make-portable-usb.ps1" (
    echo ERROR: make-portable-usb.ps1 was not found beside this file.
    pause
    exit /b 1
)
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-portable-usb.ps1"
set "result=%errorlevel%"
echo.
if "%result%"=="0" (
    echo USB copy completed successfully.
) else (
    echo Copy failed. Review the error message above.
)
pause
exit /b %result%
