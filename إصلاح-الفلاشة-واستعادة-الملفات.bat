@echo off
chcp 65001 >nul
title إصلاح الفلاشة واستعادة الملفات المخفية
cd /d "%~dp0"
echo.
echo ======================================================================
echo           أداة إنقاذ الفلاشة واستعادة الملفات وإزالة الفيروسات
echo ======================================================================
echo.

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0rescue-flash.ps1" -Drive "%~d0"

echo.
pause
