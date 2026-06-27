# Construction ERP Portal — LA Tech Solutions

A full-stack multi-role ERP web portal for construction companies, built with Next.js 15, PostgreSQL, Prisma, and Google Gemini AI.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, SWR |
| Backend | Next.js API Routes, Prisma ORM v5 |
| Database | PostgreSQL |
| Auth | NextAuth v5 beta (CredentialsProvider + Google OAuth) |
| AI | Google Gemini 1.5 Pro |
| PDF | pdfkit (server-side) |
| Images | Sharp (compression/resize) |
| Passwords | bcryptjs |

---

## Modules (15 total)

1. **Dashboard** — Role-specific: Admin/CEO overview, Manager task view, Accountant financial summary
2. **Projects** — Phases, tasks, milestones, materials, documents, PDF reports
3. **Tasks** — Kanban board + list view, priority & status management
4. **Clients** — Client profiles with project/invoice history
5. **Vendors** — Vendor directory with purchase history
6. **Contracts** — Contract management with value tracking
7. **Employees** — HR management, salary via ledger, attendance
8. **Equipment** — Asset tracking, project assignment, maintenance logs
9. **Materials** — Inventory with low-stock alerts, usage logs
10. **Finance / Ledger** — General ledger with category breakdown
11. **Finance / Accounts** — Bank accounts with statement view
12. **Finance / Payments** — Payment recording (income & expense)
13. **Finance / P&L** — Monthly profit & loss report with trend charts
14. **Invoices** — Invoice builder with line items, PDF export, mark-paid
15. **Documents** — Document library with file upload
16. **AI Assistant** — Construction chatbot (Gemini) with blueprint image analysis
17. **Users** — Admin user management, role assignment, password reset

---

## Roles & Access

| Role | Access |
|------|--------|
| `admin` | Full access — all modules, user management, audit log |
| `ceo` | Full view — all modules, financial reports |
| `manager` | Projects assigned to them, tasks, materials, equipment |
| `accountant` | Finance, invoices, payments, bank accounts |

---

## Setup Guide

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Git

### 1. Clone & Install

```bash
git clone https://github.com/iZzIbRaHiM/Construction-LAtech.git
cd construction-erp
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/construction_erp"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-32-chars-min"
GEMINI_API_KEY="your-google-gemini-api-key"

# Optional: Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### 3. Setup Database

```bash
npx prisma db push        # Push schema to PostgreSQL
npx prisma db seed        # Seed with demo data
```

### 4. Run

```bash
npm run dev               # Development server
# open http://localhost:3000
```

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@latech.pk | Admin@123 |
| CEO | ceo@latech.pk | Ceo@123 |
| Manager | manager@latech.pk | Manager@123 |
| Accountant | accounts@latech.pk | Accounts@123 |

---

## Deploy to Vercel

1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → New Project → Import repo
3. Add environment variables (DATABASE_URL, NEXTAUTH_URL, NEXTAUTH_SECRET, GEMINI_API_KEY)
4. Set `NEXTAUTH_URL` to your Vercel domain (e.g. `https://your-app.vercel.app`)
5. Deploy

> **Note:** Use a cloud PostgreSQL provider like [Neon](https://neon.tech) or [Supabase](https://supabase.com) for Vercel deployment.

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/         # Login page
│   ├── (dashboard)/          # All protected pages
│   │   ├── dashboard/        # Role-based dashboard
│   │   ├── projects/         # Project list + detail
│   │   ├── tasks/            # Kanban / list
│   │   ├── clients/
│   │   ├── vendors/
│   │   ├── contracts/
│   │   ├── employees/
│   │   ├── equipment/
│   │   ├── materials/
│   │   ├── billing/          # Invoices
│   │   ├── documents/
│   │   ├── finance/
│   │   │   ├── accounts/
│   │   │   ├── ledger/
│   │   │   ├── payments/
│   │   │   └── profit-sheets/
│   │   ├── admin/users/
│   │   └── ai-assistant/
│   └── api/                  # 30+ API routes
├── lib/
│   ├── auth.ts               # NextAuth config
│   ├── prisma.ts             # Prisma client singleton
│   ├── api-helpers.ts        # requireAuth, requireRole, ok, created
│   ├── audit.ts              # Audit log helper
│   ├── notify.ts             # Notification helper
│   └── pdf-generator.ts      # Invoice + project report PDFs
prisma/
├── schema.prisma             # 30+ models, lowercase enums
└── seed.ts                   # Demo data seeder
```

---

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check
npx prisma studio    # GUI database browser
npx prisma db seed   # Re-run seed
```

---

*Built by LA Tech Solutions · 2026*
