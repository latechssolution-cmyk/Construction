@echo off
title Construction ERP - Dev Server
cd /d "%~dp0"

echo.
echo Construction ERP starting at http://localhost:3000
echo Press CTRL+C to stop.
echo.

timeout /t 2 /nobreak >nul
start http://localhost:3000
call npm run dev
