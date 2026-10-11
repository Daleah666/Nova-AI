@echo off
title Subliminal Maker setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0subliminal.ps1" -Setup
echo.
pause
