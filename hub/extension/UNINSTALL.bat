@echo off
title Uninstall The Hub extension
echo.
echo  To remove The Hub extension, click its toolbar button and press Uninstall,
echo  or click Remove on its card in chrome://extensions (opening now).
echo  After that you can delete this folder.
echo.
powershell.exe -NoProfile -Command "$l = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Update The Hub.lnk'; if (Test-Path $l) { Remove-Item $l; Write-Host '  Removed the Update The Hub desktop shortcut.' }"
start "" chrome "chrome://extensions"
pause
