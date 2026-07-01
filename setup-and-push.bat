@echo off
echo =====================================================
echo   Construction ERP - Setup and GitHub Push Script
echo   LA Tech Solutions
echo =====================================================
echo.

echo [1/5] Checking Node.js...
node --version
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [2/5] Installing dependencies...
call npm install --legacy-peer-deps
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo [3/5] Checking .env file...
if not exist ".env" (
    echo WARNING: .env file not found!
    echo Please copy .env.example to .env and fill in your values:
    echo   MONGODB_URI, AUTH_SECRET, GEMINI_API_KEY
    echo.
    echo Then re-run this script.
    pause
    exit /b 1
)
echo .env found.

echo.
echo [4/5] Running database seed...
call npm run db:seed
if errorlevel 1 (
    echo WARNING: Seed failed (may already be seeded). Continuing...
)

echo.
echo [5/5] Committing and pushing to GitHub...
git add .
git commit -m "feat: complete Construction ERP Portal v2 rebuild

FULL REWRITE with correct MongoDB adapter + Mongoose schemas + all API routes + frontend pages

Backend (30+ API routes, zero stubs):
- Auth: NextAuth v5 beta, CredentialsProvider + Google OAuth, bcryptjs
- Projects: phases, tasks, milestones, materials, equipment, documents
- Finance: ledger, bank accounts, invoices with PDF export (pdfkit)
- HR: employees, attendance, salary via ledger, equipment assign/return
- AI: Google Gemini 1.5 Pro construction chatbot with image analysis
- Notifications, audit log, file uploads with direct-to-Cloudinary upload

Frontend (18 pages, use client + SWR, real API calls, no mock data):
- Role dashboards: admin/ceo/manager/accountant
- Projects with 8-tab detail page (phases, milestones, finance, docs)
- Kanban task board + list view
- Materials inventory with low-stock alerts
- Invoices with line-item builder + PDF download + mark-paid
- Ledger, bank accounts with statements, payments, P&L report
- Documents with file upload
- Equipment with project assign/return
- AI Assistant chat with image upload
- User management with role change + password reset

Tech: Next.js 15, TypeScript, MongoDB, Mongoose, NextAuth v5,
      Tailwind CSS, SWR, pdfkit, Sharp, bcryptjs, Google Gemini"

git push origin main
if errorlevel 1 (
    echo.
    echo Push failed. If this is first push, try:
    echo   git remote add origin https://github.com/iZzIbRaHiM/Construction-LAtech.git
    echo   git push -u origin main
    echo.
    echo If there are conflicts:
    echo   git pull origin main --allow-unrelated-histories
    echo   git push origin main
)

echo.
echo =====================================================
echo   DONE!
echo.
echo   Demo credentials:
echo     Admin:     admin@constructionlatech.com / Admin@1234
echo     CEO:       ceo@constructionlatech.com / Ceo@1234
echo     Manager:   manager@constructionlatech.com / Manager@1234
echo     Accountant: accountant@constructionlatech.com / Account@1234
echo.
echo   Start dev server: npm run dev
echo   Open: http://localhost:3000
echo =====================================================
pause
