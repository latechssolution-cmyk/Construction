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
echo [1/6] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo   ERROR: Node.js not found. Install from https://nodejs.org
    start https://nodejs.org/en/download
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do echo   Node.js %%v found. OK
echo.

:: --- Step 2: Check MongoDB ---
echo [2/6] Checking MongoDB...
echo   Note: If using MongoDB Atlas (Cloud), make sure to configure MONGODB_URI in your .env.
echo   Checking for local MongoDB service...
sc query MongoDB >nul 2>&1
if errorlevel 1 (
    echo   WARNING: Local MongoDB service not detected on this machine.
    echo   This is OK if you plan to use MongoDB Atlas (Cloud).
    echo   Otherwise, install local MongoDB from: https://www.mongodb.com/try/download/community
) else (
    echo   Local MongoDB service found. Attempting to start if not running...
    net start MongoDB >nul 2>&1
    echo   Local MongoDB service verified. OK
)
echo.

:: --- Step 3: npm install ---
echo [3/6] Installing npm packages (2-3 minutes)...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo   ERROR: npm install failed.
    pause
    exit /b 1
)
echo   Packages installed. OK
echo.

:: --- Step 4: Create .env if missing ---
echo [4/6] Checking environment configuration...
if not exist ".env" (
    echo   .env not found. Creating with local MongoDB defaults...
    node -e "const s=require('crypto').randomBytes(32).toString('base64');const fs=require('fs');fs.writeFileSync('.env','MONGODB_URI=\"mongodb://localhost:27017/construction_erp\"\r\nNEXTAUTH_URL=\"http://localhost:3000\"\r\nAUTH_SECRET=\"'+s+'\"\r\nNEXT_PUBLIC_APP_NAME=\"Construction ERP\"\r\n# Optional - add to enable Google login:\r\n# GOOGLE_CLIENT_ID=\r\n# GOOGLE_CLIENT_SECRET=\r\n# Optional - add to enable AI assistant:\r\n# GEMINI_API_KEY=\r\n# Optional - add to enable cloud file uploads:\r\n# CLOUDINARY_CLOUD_NAME=\r\n# CLOUDINARY_API_KEY=\r\n# CLOUDINARY_API_SECRET=\r\n');"
    if errorlevel 1 (
        echo   ERROR: Could not create .env file.
        pause
        exit /b 1
    )
    echo   .env created with secure random AUTH_SECRET. OK
) else (
    echo   .env already exists. OK
)
echo.

:: --- Step 5: Seed database ---
echo [5/6] Seeding MongoDB with demo data...
call npm run db:seed
if errorlevel 1 (
    echo   WARNING: Seed failed or already seeded. Continuing...
) else (
    echo   Seed data loaded. OK
)
echo.

:: --- Step 6: Launch ---
echo [6/6] Starting server...
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
