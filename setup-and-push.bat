@echo off
echo =====================================================
echo   Construction ERP - Setup and GitHub Push Script
echo   LA Tech Solutions
echo =====================================================
echo.

echo [1/6] Checking Node.js...
node --version
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [2/6] Installing dependencies...
npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo [3/6] Checking .env file...
if not exist ".env" (
    echo WARNING: .env file not found!
    echo Please copy .env.example to .env and fill in your values:
    echo   DATABASE_URL, NEXTAUTH_SECRET, GEMINI_API_KEY
    echo.
    echo Then re-run this script.
    pause
    exit /b 1
)
echo .env found.

echo.
echo [4/6] Pushing Prisma schema to database...
npx prisma db push
if errorlevel 1 (
    echo ERROR: prisma db push failed. Check your DATABASE_URL in .env
    pause
    exit /b 1
)

echo.
echo [5/6] Running database seed...
npx prisma db seed
if errorlevel 1 (
    echo WARNING: Seed failed (may already be seeded). Continuing...
)

echo.
echo [6/6] Committing and pushing to GitHub...
git add .
git commit -m "feat: complete Construction ERP Portal v2 rebuild

FULL REWRITE with correct Prisma schema + all API routes + frontend pages

Backend (30+ API routes, zero stubs):
- Auth: NextAuth v5 beta, CredentialsProvider + Google OAuth, bcryptjs
- Projects: phases, tasks, milestones, materials, equipment, documents
- Finance: ledger, bank accounts, invoices with PDF export (pdfkit)
- HR: employees, attendance, salary via ledger, equipment assign/return
- AI: Google Gemini 1.5 Pro construction chatbot with image analysis
- Notifications, audit log, file uploads with Sharp image compression

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

Schema: lowercase enums, passwordHash, assignedManagerId, BankAccount,
        LedgerEntry (replaces Payment), Invoice/InvoiceItem (replaces Bill)

Tech: Next.js 15, TypeScript, PostgreSQL, Prisma v5, NextAuth v5,
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
echo     Admin:     admin@latech.pk / Admin@123
echo     CEO:       ceo@latech.pk / Ceo@123
echo     Manager:   manager@latech.pk / Manager@123
echo     Accountant: accounts@latech.pk / Accounts@123
echo.
echo   Start dev server: npm run dev
echo   Open: http://localhost:3000
echo =====================================================
pause
