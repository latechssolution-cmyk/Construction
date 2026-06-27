@echo off
title Construction ERP - Dev Server
cd /d "%~dp0"

:: Add PostgreSQL to PATH
set "PG_BIN="
for %%d in (17 16 15 14) do (
    if exist "C:\Program Files\PostgreSQL\%%d\bin\psql.exe" (
        if not defined PG_BIN set "PG_BIN=C:\Program Files\PostgreSQL\%%d\bin"
    )
)
if defined PG_BIN set "PATH=%PG_BIN%;%PATH%"

:: Start PostgreSQL if not running
set PGPASSWORD=postgres
pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo Starting PostgreSQL service...
    net start postgresql-x64-17 >nul 2>&1
    net start postgresql-x64-16 >nul 2>&1
    net start postgresql-x64-15 >nul 2>&1
    net start postgresql-x64-14 >nul 2>&1
    timeout /t 3 /nobreak >nul
)

echo.
echo Construction ERP starting at http://localhost:3000
echo Press CTRL+C to stop.
echo.

timeout /t 2 /nobreak >nul
start http://localhost:3000
call npm run dev
