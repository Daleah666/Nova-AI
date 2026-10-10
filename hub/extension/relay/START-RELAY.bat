@echo off
title The Hub relay
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js isn't installed yet. Get the LTS version from https://nodejs.org , then run this again.
  echo.
  pause
  exit /b 1
)
node "%~dp0hub-mcp.mjs" --serve
echo.
pause
