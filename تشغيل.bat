@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo   ==============================================
echo     Mathakkarati Launcher
echo     Browser will open at http://127.0.0.1:8787
echo     Local Qwen3 model starts automatically the
echo     first time you ask for a written answer.
echo     Close this window to stop the server.
echo   ==============================================
echo.
python server.py
echo.
pause