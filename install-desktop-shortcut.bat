@echo off
setlocal
title Install Desktop Shortcut
cd /d "%~dp0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0create-desktop-shortcut.ps1"
pause
