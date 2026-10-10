@echo off
title Update The Hub extension
echo.
echo  Updating The Hub extension
echo  --------------------------
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update.ps1" "%~1"
echo.
pause
