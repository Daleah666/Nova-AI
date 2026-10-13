@echo off
title Install The Hub extension
echo.
echo  Installing The Hub extension
echo  ----------------------------
echo  1. Chrome's extensions page and this folder will open.
echo  2. Turn on "Developer mode" (top right).
echo  3. Click "Load unpacked" and choose this folder:
echo     %~dp0
echo.
echo  Keep this folder where it is. Chrome loads the extension from here.
echo  To update later: download the new zip, then double-click UPDATE.bat in this folder.
echo.
start "" explorer "%~dp0"
start "" chrome "chrome://extensions"
pause
