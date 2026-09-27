@echo off
chcp 65001 >nul
title تثبيت مذكّرتي الذكية (Mada-RAG) من الفلاشة إلى قرص C:
cd /d "%~dp0"
echo.
echo ======================================================================
echo       تثبيت مذكّرتي الذكية (Mada-RAG) من الحزمة المحمية إلى قرص C:
echo ======================================================================
echo.
echo سيتم نسخ الحزمة المضغوطة وفك ضغطها وربط النموذج واختصار سطح المكتب تلقائياً.
echo.

powershell -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-zip-to-c.ps1"

echo.
pause
