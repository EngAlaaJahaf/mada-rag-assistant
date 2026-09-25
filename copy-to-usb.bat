@echo off
setlocal
title Mada-RAG USB Fast Sync
cd /d "%~dp0"

if not exist "%~dp0make-portable-usb.ps1" (
    echo [ERROR] make-portable-usb.ps1 was not found.
    pause
    exit /b 1
)

"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0make-portable-usb.ps1"
set "result=%errorlevel%"

echo.
if "%result%"=="0" (
    echo =====================================================================
    echo [SUCCESS] USB deployment completed successfully!
    echo =====================================================================
) else (
    echo [ERROR] Deployment failed. Review the messages above.
)

pause
exit /b %result%
