@echo off
setlocal
cd /d "%~dp0"
if exist "%~dp0mada-rag\run-mada-rag.bat" (
    start "" "%~dp0mada-rag\run-mada-rag.bat"
) else (
    echo [ERROR] mada-rag folder was not found.
    pause
)
