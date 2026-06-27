@echo off
setlocal EnableDelayedExpansion
title Construction ERP - Full Installation
cd /d "%~dp0"

echo.
echo ============================================================
echo   Construction ERP Portal - Full Installation
echo   LA Tech Solutions
echo ============================================================
echo.

:: --- Step 1: Check Node.js ---
echo [1/8] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js not found. Install from https://nodejs.org
    start https://nodejs.org/en/download
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo   Node.js %%v found. OK
echo.

:: --- Step 2: Locate PostgreSQL ---
echo [2/8] Locating PostgreSQL...
set "PG_BIN="
for %%d in (17 16 15 14) do (
    if exist "C:\Program Files\PostgreSQL\%%d\bin\psql.exe" (
        if not defined PG_BIN set "PG_BIN=C:\Program Files\PostgreSQL\%%d\bin"
    )
)
if defined PG_BIN (
    set "PATH=%PG_BIN%;%PATH%"
    echo   Found PostgreSQL at %PG_BIN%
) else (
    echo   PostgreSQL not found. Please install from:
    echo   https://www.postgresql.org/download/windows/
    echo   Use password: postgres
    start https://www.postgresql.org/download/windows/
    pause
    exit /b 1
)
echo.

:: --- Step 3: Start PostgreSQL ---
echo [3/8] Starting PostgreSQL service...
set PGPASSWORD=postgres
net start postgresql-x64-17 >nul 2>&1
net start postgresql-x64-16 >nul 2>&1
net start postgresql-x64-15 >nul 2>&1
net start postgresql-x64-14 >nul 2>&1
timeout /t 4 /nobreak >nul
pg_isready -U postgres >nul 2>&1
if errorlevel 1 (
    echo   WARNING: PostgreSQL not responding. Check service status.
) else (
    echo   PostgreSQL running. OK
)
echo.

:: --- Step 4: Create database ---
echo [4/8] Creating database...
set PGPASSWORD=postgres
psql -U postgres -c "CREATE DATABASE construction_erp;" >nul 2>&1
psql -U postgres -d construction_erp -c "SELECT 1;" >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Cannot connect to PostgreSQL.
    echo   Make sure postgres password is "postgres".
    pause
    exit /b 1
)
echo   Database ready. OK
echo.

:: --- Step 5: npm install ---
echo [5/8] Installing npm packages (2-3 minutes)...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo   ERROR: npm install failed.
    pause
    exit /b 1
)
echo   Packages installed. OK
echo.

:: --- Step 6: Create .env if missing ---
echo [6/8] Checking environment configuration...
if not exist ".env" (
    echo   .env not found. Creating with local defaults...
    node -e "const s=require('crypto').randomBytes(32).toString('base64');const fs=require('fs');fs.writeFileSync('.env','DATABASE_URL=\"postgresql://postgres:postgres@localhost:5432/construction_erp\"\r\nNEXTAUTH_URL=\"http://localhost:3000\"\r\nNEXTAUTH_SECRET=\"'+s+'\"\r\nNEXT_PUBLIC_APP_NAME=\"Construction ERP\"\r\n# Optional - add to enable Google login:\r\n# GOOGLE_CLIENT_ID=\r\n# GOOGLE_CLIENT_SECRET=\r\n# Optional - add to enable AI assistant:\r\n# GEMINI_API_KEY=\r\n# Optional - add to enable cloud file uploads:\r\n# CLOUDINARY_CLOUD_NAME=\r\n# CLOUDINARY_API_KEY=\r\n# CLOUDINARY_API_SECRET=\r\n');"
    if errorlevel 1 (
        echo   ERROR: Could not create .env file.
        pause
        exit /b 1
    )
    echo   .env created with secure random NEXTAUTH_SECRET. OK
) else (
    echo   .env already exists. OK
)
echo.

:: --- Step 7: Prisma setup ---
echo [7/8] Setting up database schema and seed data...
call npx prisma generate
if errorlevel 1 (
    echo   ERROR: Prisma generate failed.
    pause
    exit /b 1
)
call npx prisma db push --accept-data-loss
if errorlevel 1 (
    echo   ERROR: Prisma db push failed. Check .env DATABASE_URL.
    pause
    exit /b 1
)
echo   Database schema applied. OK
call npx prisma db seed
if errorlevel 1 (
    echo   WARNING: Seed data failed or already seeded. Continuing...
) else (
    echo   Seed data loaded. OK
)
echo.

:: --- Step 8: Launch ---
echo [8/8] Starting server...
echo.
echo ============================================================
echo   SETUP COMPLETE!
echo.
echo   URL:  http://localhost:3000
echo.
echo   Default Login Credentials:
echo     Admin:      admin@constructionlatech.com    / Admin@1234
echo     CEO:        ceo@constructionlatech.com      / Ceo@1234
echo     Manager:    manager@constructionlatech.com  / Manager@1234
echo     Accountant: accountant@constructionlatech.com / Account@1234
echo.
echo   IMPORTANT: Change these passwords after first login!
echo   Settings are at: http://localhost:3000/settings
echo.
echo   Press CTRL+C to stop the server.
echo ============================================================
echo.
timeout /t 3 /nobreak >nul
start http://localhost:3000
call npm run dev
