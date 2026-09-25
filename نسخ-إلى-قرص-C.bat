@echo off
setlocal
title Mada-RAG Deploy to Drive C:
cd /d "%~dp0"

if not exist "%~dp0mada-usb-to-c.ps1" (
    echo [ERROR] mada-usb-to-c.ps1 was not found.
    pause
    exit /b 1
)

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0mada-usb-to-c.ps1"
set "result=%errorlevel%"

echo.
if "%result%"=="0" (
    echo =====================================================================
    echo [SUCCESS] Mada-RAG was successfully copied to C:\mada-rag!
    echo =====================================================================
) else (
    echo [ERROR] Copy failed. Review the messages above.
)

pause
exit /b %result%
