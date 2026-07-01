# Construction ERP Portal — LA Tech Solutions

A full-stack multi-role ERP web portal for construction companies, built with Next.js 15, MongoDB, Mongoose, and Google Gemini AI.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router), TypeScript, Tailwind CSS, SWR |
| Backend | Next.js API Routes, Mongoose |
| Database | MongoDB (Local / Atlas Cloud) |
| Auth | NextAuth v5 beta (CredentialsProvider + Google OAuth) |
| AI | Google Gemini 1.5 Pro |
| PDF | pdfkit (server-side) |
| Images | Sharp (compression/resize) |
| Passwords | bcryptjs |

---

## Modules (17 total)

1. **Dashboard** — Role-specific: Admin/CEO overview, Manager task view, Accountant financial summary
2. **Projects** — Phases, tasks, milestones (with name, description, due date), materials, documents, PDF reports
3. **Tasks** — Kanban board + list view, priority & status management
4. **Clients** — Client profiles with project/invoice history
5. **Vendors** — Vendor directory with purchase history
6. **Contracts** — Contract management with value tracking
7. **Employees** — HR management, salary via ledger, attendance
8. **Attendance** — Mark attendance modal with checkboxes, notes, and Half Day support
9. **Equipment** — Asset tracking, project assignment, maintenance logs
10. **Materials** — Inventory with low-stock alerts, usage logs
11. **Finance / Ledger** — General ledger with category breakdown
12. **Finance / Accounts** — Bank accounts with statement view
13. **Finance / Payments** — Payment recording (income & expense)
14. **Finance / P&L** — Monthly profit & loss report with trend charts
15. **Invoices** — Invoice builder with line items, PDF export, mark-paid
16. **Documents** — Document library with file upload
17. **AI Assistant** — Construction chatbot (Gemini) with blueprint image analysis
18. **Users** — Admin user management, role assignment, password reset

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
- MongoDB (Local or Atlas Cloud Account)
- Git

### 1. Clone & Install

```bash
git clone https://github.com/iZzIbRaHiM/Construction-LAtech.git
cd construction-erp
npm install --legacy-peer-deps
```

### 2. Configure Environment

Copy `.env.example` to `.env` and fill in:

```env
MONGODB_URI="mongodb+srv://USER:PASSWORD@cluster.mongodb.net/construction_erp?retryWrites=true&w=majority"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="your-secret-32-chars-min"
GEMINI_API_KEY="your-google-gemini-api-key"

# Optional: Google OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

# Optional: Cloudinary (file uploads)
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

### 3. Setup Database

To seed your database with demo data:

```bash
npm run db:seed
```

### 4. Run

```bash
npm run dev               # Start development server
# open http://localhost:3000
```

---

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@constructionlatech.com | Admin@1234 |
| CEO | ceo@constructionlatech.com | Ceo@1234 |
| Manager | manager@constructionlatech.com | Manager@1234 |
| Accountant | accountant@constructionlatech.com | Account@1234 |

---

## Deploy to Netlify / Vercel

1. Push to GitHub
2. Go to Netlify/Vercel → New Project → Import repo
3. Add environment variables (`MONGODB_URI`, `NEXTAUTH_URL`, `AUTH_SECRET`, `GEMINI_API_KEY`)
4. Deploy

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
│   ├── api-helpers.ts        # requireAuth, requireRole, ok, created
│   ├── mongoose.ts           # Mongoose DB connection helper
│   ├── audit.ts              # Audit log helper
│   ├── notify.ts             # Notification helper
│   └── pdf-generator.ts      # Invoice + project report PDFs
scripts/
└── seed.ts                   # Mongoose demo data seeder
```

---

## Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Production build
npm run start        # Production server
npm run lint         # ESLint check
npm run db:seed      # Seed the database
```

---

*Built by LA Tech Solutions · 2026*
