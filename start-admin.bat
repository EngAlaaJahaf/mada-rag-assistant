@echo off
chcp 65001 >nul
title مذكّرتي شات — بدء كمسؤول
echo تشغيل خادم مذكّرتي شات بصلاحيات مسؤول (نافذة الإذن تظهر مرة واحدة)...
powershell -NoProfile -Command "Start-Process -FilePath 'python' -ArgumentList '-X','utf8','server.py' -WorkingDirectory '%~dp0' -Verb RunAs"
echo تم إطلاق الخادم. يمكنك إغلاق هذه النافذة.
pause