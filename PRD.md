# Construction ERP — Vercel Migration + UX Simplification PRD

Status: **Approved for implementation (in progress)**
Owner: LA Tech Solutions
Last updated: 2026-07-09

---

## 1. Background & Problem Statement

The system is a Next.js 15 / MongoDB (Mongoose) / NextAuth construction ERP, currently deployed on
**Netlify**. Two independent problems need solving:

1. **Hosting**: move from Netlify to **Vercel** (native Next.js platform — App Router, Server
   Actions, ISR, and Cron Jobs are first-class there, whereas Netlify needs the community
   `@netlify/plugin-nextjs` adapter and has no native cron primitive we're currently using).
2. **UX complexity**: the client finds the system hard to use. Root cause, confirmed by reading
   the codebase: the sidebar has **15 top-level destinations** (Dashboard, Projects, Contracts,
   Clients, Vendors, Tasks, Materials, Equipment, Employees, Attendance, Finance [4 children],
   Billing, Documents, AI Assistant, Users). Data that conceptually belongs to *one project*
   (materials, tasks, team, money) is split between a **general/global page** (e.g. `/materials`,
   `/finance/ledger`) and a **read-only mirror inside the project** (`/projects/[id]` tabs). Users
   have to context-switch constantly and re-filter by project every time.

This PRD defines the target IA (information architecture), the data/API changes required, and the
Vercel migration plan, in priority order.

---

## 2. Research: how top construction ERPs structure this

(Web research — Procore, Buildertrend/Buildern comparisons, Archdesk, Fieldwire, 2026 sources.)

- **Procore** treats the *project* as the top-level object. Financial tools (budget, commitments,
  change orders, WIP) live **inside** the project and roll up into a company-wide
  reporting/ERP-integration layer for accounting — but a PM never has to leave the project to log a
  cost or see budget-vs-actual. Company-wide ledger/GL detail is deliberately hidden from
  field/PM roles; they only see the project-scoped view.
- **Buildertrend** (residential-focused) keeps *client communication + budget + daily logs* inside
  the job, with company-wide sections reserved for things that are genuinely cross-project:
  the *company* directory (customers/vendors/subs) and estimates templates.
- Common pattern across all of them: **directory-style entities (clients, vendors, subs, staff)
  are company-wide** (you don't want 10 copies of "ABC Cement Suppliers", one per project) but
  **transactional entities (cost/ledger entries, materials receipts, tasks, RFIs, daily logs)
  are project-owned** and created/edited from inside the project.

This maps directly onto the requested change: **project-wise ledger and materials**, with
**People (clients/vendors/employees) as one shared directory**, not duplicated per project.

---

## 3. Target Information Architecture

### 3.1 Sidebar — before (15 destinations) → after (9 destinations)

| Before | After |
|---|---|
| Dashboard | Dashboard |
| Projects | Projects *(all project work happens inside a project now)* |
| Contracts | *(merged into Projects → project detail → "Contract" tab, since a contract belongs to a project's client engagement)* |
| Clients | **People** *(tab: Clients)* |
| Vendors | **People** *(tab: Vendors)* |
| Employees | **People** *(tab: Employees, incl. Salary History)* |
| Tasks | *(removed — Tasks already live inside each project's "Phases & Tasks" tab; the global `/tasks` list becomes a My Tasks widget on the Dashboard instead of a nav item)* |
| Materials | *(removed as a destination — materials are created/edited inside each project's Materials tab; a read-only company-wide Materials **report** is reachable from Dashboard/Reports, not the primary nav)* |
| Equipment | Equipment *(stays global — equipment is a shared company asset pool assigned across projects, matches Procore/Buildertrend pattern for shared resources)* |
| Attendance | *(removed as top nav — moved under People → Employees → Attendance sub-tab, since attendance is inherently employee-centric)* |
| Finance (Ledger/Accounts/Payments/Profit Sheets) | **Finance** *(kept, but scope changes — see 3.3)* |
| Billing | *(merged into Projects → project detail → "Finance" tab, since invoices belong to one project/client)* |
| Documents | Documents *(stays — cross-project file storage is a legitimate shared utility)* |
| AI Assistant | AI Assistant *(unchanged)* |
| Users (admin) | Settings *(admin/users moves under Settings, one gear icon instead of a separate nav row)* |

Result: **Dashboard, Projects, People, Equipment, Finance, Documents, AI Assistant, Settings** = 8
top-level items (down from 15), plus the existing search (⌘K) for power users who want to jump
anywhere instantly.

### 3.2 Project detail page — the primary workspace

`/projects/[id]` already has a tab strip: `Overview | Phases & Tasks | Materials | Team | Finance |
Documents | Milestones | Report`. This is the right shape and mostly already works. Changes:

- **Materials tab**: already creates materials scoped to the project with no project selector —
  ✅ keep as-is, this is the reference implementation for "same input/finance flow, no project
  picker" requested for the general Materials section.
- **Finance tab**: currently **read-only** (lists ledger entries, no create/edit/delete). This is
  the biggest gap. **Add full CRUD** here: "+ Add Entry" button opens the same form fields as
  `/finance/ledger` (date, type, category, amount, description, bank account, vendor/party) minus
  the project selector (it's implicit). Edit/delete follow the same role rules as today
  (admin/ceo/accountant, reversal-not-delete for money-moving entries).
- **New "Contract" tab**: pulls in the contract-value/status/variations UI that currently lives at
  `/contracts`, scoped to this project's contract.
- **Billing folds into Finance tab**: invoices for this project's client are listed/created here
  instead of a separate global Billing page.

### 3.3 Finance (global) — becomes an oversight/rollup section, not a data-entry section

Once ledger entries are created from inside projects, the global Finance section's job changes
from "where you enter transactions" to "where you see the roll-up":
- **Ledger** → becomes a read-only, filterable, cross-project register (for reconciliation/audit).
  Non-project entries (e.g. head-office overhead, opening balances) are still entered here since
  they have no project to belong to.
- **Accounts** → unchanged (bank account management is inherently company-wide).
- **Payments** → same data as Ledger, kept as a quick "money movement" view; direct-entry UI stays
  for non-project transactions only.
- **Profit Sheets** → unchanged (company-wide P&L necessarily spans all projects).

### 3.4 People — single directory section

New `/people` route. Tab strip: `Clients | Vendors | Employees`. Each tab renders the **existing,
already-correct** page logic (CRUD, search, activate/deactivate) — reused as components, not
rewritten, to avoid introducing new bugs into logic that's already been audited and fixed this
session. The old `/clients`, `/vendors`, `/employees` routes keep working (deep links, bookmarks)
but are removed from the sidebar.

**Employees tab gets one addition: a "Salary History" sub-view**, month-wise:
- Uses the existing `LedgerEntry` records (`category: "salary"`, which already carries
  `employeeId` and a `[FOR:YYYY-MM]` tag in the description — see
  `src/app/api/employees/[id]/salary/route.ts`).
- New `GET /api/ledger?category=salary&employeeId=...` support (the ledger route already accepts
  `category`; add `employeeId` as an additional filter param).
- UI: a month picker + employee filter, table of {employee, month, gross, deductions, net, paid
  date, bank account}, matching what payroll software calls a "payroll register."

### 3.5 Attendance — moves under People → Employees

Attendance is inherently "per employee, per day" — it belongs next to the employee record, not as
its own top-level nav item. Implemented as a sub-tab on the Employees tab (`Employees | Attendance`
sub-toggle), reusing the existing `/attendance` page logic as a component.

---

## 4. Non-Goals / What we are *not* changing

- **No new database migration.** All entities keep their current Mongoose schemas — this is a
  navigation/composition change, not a data model change (the one exception: `LedgerEntry` GET
  gains an `employeeId` query param, which is additive and backward-compatible).
- **No change to role/permission logic.** Every CRUD operation moved into a project tab uses the
  exact same API route and role check it uses today (e.g. project-scoped ledger POST is still
  `POST /api/ledger` with `projectId` pre-filled — no new endpoint).
- **Old routes are not deleted in this phase.** `/clients`, `/vendors`, `/employees`,
  `/attendance`, `/materials`, `/tasks`, `/billing`, `/contracts` keep working for deep links;
  only sidebar entries change. This makes the rollout reversible at zero data risk.

---

## 5. Vercel Migration Plan

### 5.1 Why Vercel over Netlify here specifically
- Native **Vercel Cron Jobs** (`vercel.json` → `crons[]`) replace the currently-unscheduled
  `POST /api/cron/equipment-costing` endpoint (today it has no automatic trigger configured
  anywhere in this repo — it's dead code waiting for a scheduler). Vercel Cron sends a `GET`
  request with a `Vercel-Cron` mechanism; Netlify has no equivalent built into the free/pro tier
  without an external cron service.
- One less adapter layer: `@netlify/plugin-nextjs` shims App Router/Server Actions/Image
  Optimization; Vercel runs Next.js natively (same team builds both).
- `next.config.ts` already only uses framework-native `headers()` — no Netlify-specific config to
  port.

### 5.2 Steps
1. Add `vercel.json`:
   ```json
   {
     "crons": [
       { "path": "/api/cron/equipment-costing", "schedule": "0 20 * * *" }
     ]
   }
   ```
2. Update `src/app/api/cron/equipment-costing/route.ts` to accept **GET** (Vercel Cron only calls
   GET) in addition to POST (manual/admin trigger), verifying the request via the
   `Authorization: Bearer $CRON_SECRET` header Vercel automatically attaches when `CRON_SECRET` is
   set in project env vars — no change to the auth logic itself, just add a GET export.
3. Remove `netlify.toml` and the `@netlify/plugin-nextjs` devDependency from `package.json`.
4. Rewrite `DEPLOY.md` — it currently documents a **Prisma + PostgreSQL** stack that doesn't match
   this codebase at all (it's Mongoose + MongoDB Atlas). Replace with accurate Vercel + MongoDB
   Atlas steps and the real env var list (`MONGODB_URI`, `NEXTAUTH_URL`, `AUTH_SECRET`,
   `GOOGLE_CLIENT_ID/SECRET`, `GEMINI_API_KEY`, `CLOUDINARY_*`, `NEXT_PUBLIC_APP_NAME`,
   `CRON_SECRET`).
5. Security headers: already defined in `next.config.ts` `headers()` (framework-native) — nothing
   to port from `netlify.toml`'s `[[headers]]` block, it's redundant with the Next.js config and
   can be deleted along with the file.
6. Env vars: copy the 7 keys from `.env` into Vercel Project Settings → Environment Variables
   (Production + Preview). Update `NEXTAUTH_URL` and Google OAuth authorized redirect URI to the
   `*.vercel.app` (then custom) domain.
7. Deploy, smoke-test login + one CRUD flow + the cron endpoint manually
   (`curl -X POST .../api/cron/equipment-costing -H "Authorization: Bearer $CRON_SECRET"`), then
   cut DNS over from Netlify.

### 5.3 Rollback
Netlify site stays intact and un-deleted until the Vercel deployment has been live and stable for
a full billing cycle — zero-cost safety net since both are free-tier-capable for this app's size.

---

## 6. Implementation Phases (execution order)

| Phase | Scope | Risk | Status |
|---|---|---|---|
| **P1** | Vercel migration (§5) | Low — mechanical, reversible | ✅ Done |
| **P2** | People section: `/people` hub composing existing Clients/Vendors/Employees pages as tabs; sidebar nav update | Low — reuses existing, already-audited page logic | ✅ Done |
| **P3** | Salary History month-wise view under People → Employees | Low — additive API param + new read-only UI | ✅ Done |
| **P4** | Project Finance tab: add full ledger CRUD (create/edit/delete) scoped to the project, no project selector | Medium — new write UI, must reuse existing `/api/ledger` validation exactly | ✅ Done |
| **P5** | Attendance tab under People (reuse existing page as component) | Low | ✅ Done |
| **P6** | Contract tab + Billing (invoices) tab inside the project detail page | Medium — larger page, more state | ✅ Done |
| **P7** | Global Materials/Tasks/Contracts/Billing/Attendance/Clients/Vendors/Employees pages demoted from primary sidebar nav (kept as deep-linkable) | Low | ✅ Done |
| **P8** | Backend automation: persist overdue invoice status via the daily cron sweep | Low — additive, no user-facing flow at all | ✅ Done |

### P1–P4 implementation notes
- `netlify.toml` removed; `vercel.json` added with the equipment-costing cron schedule.
- `/api/cron/equipment-costing` now accepts GET (Vercel Cron) in addition to POST (manual trigger).
- `DEPLOY.md` and `DEPLOY_CHECKLIST.md` rewritten to match the actual Mongoose/MongoDB stack
  (they previously documented a Prisma/PostgreSQL stack that didn't exist in this codebase).
- `/people` (`src/app/(dashboard)/people/page.tsx`) composes the existing `ClientsPage`,
  `VendorsPage`, `EmployeesPage` components as tabs — zero logic duplication, zero risk to
  already-audited CRUD code. Old `/clients`, `/vendors`, `/employees` routes still work (deep
  links preserved) but are no longer in the sidebar.
- Sidebar (`src/components/layout/sidebar.tsx`) went from 15 to 12 top-level rows (People
  replaces Clients/Vendors/Employees). Attendance/Materials/Tasks/Contracts/Billing consolidation
  (P5–P7) is scoped for the next pass to keep this change reviewable.
- `SalaryHistory` (`src/components/people/salary-history.tsx`) reads `/api/ledger?category=salary`
  (now supports an `employeeId` filter, added to `src/app/api/ledger/route.ts`), grouping by the
  `[FOR:YYYY-MM]` tag already embedded in salary ledger descriptions. Visible to
  admin/ceo/accountant only, matching who can already pay salaries.
- Project detail page (`/projects/[id]`) Finance tab gained full create/edit/reverse for ledger
  entries scoped to the project (`projectId` implicit, no picker) — same fields, validation, and
  category list as the general Ledger page. Edit uses `PUT /api/ledger/[id]` (admin/ceo/accountant);
  removal uses `DELETE /api/payments/[id]` (admin/ceo only), which creates a compensating reversal
  entry instead of a hard delete, preserving the audit trail — the same mechanism already used by
  the general Payments page.
- Fixed a pre-existing bug found while wiring this up: `GET /api/projects/[id]` never populated
  `bankAccount`/`vendor` on `ledgerEntries`, so the project Finance tab could never show the bank
  account name even before this change. Added the missing `.populate()` calls.
- Verified via `npx tsc --noEmit` (zero errors) and authenticated `curl` smoke tests against the
  dev server — `/people` and `/projects/[id]` both return 200 with no error markers, and
  `GET /api/projects/[id]` confirmed the new `bankAccount`/`vendor` populate is present on
  `ledgerEntries`. (Also fixed two unrelated pre-existing bugs surfaced by the `tsc` pass: a
  duplicate `auditLog` import in `milestones/[id]/route.ts` and a `ClientSession` type mismatch in
  the salary route's transaction session.)

### P5–P8 implementation notes
- **Attendance** is now a tab inside `/people` (reuses `AttendancePage` as-is), gated to
  admin/ceo/manager same as before. `/attendance` still resolves directly for deep links.
- **Contract tab** (`/projects/[id]`): if the project has no linked contract, shows an inline
  "Create & Link Contract" form (`POST /api/contracts` then `PUT /api/projects/[id]` with the new
  `contractId` — both endpoints already existed and already supported this, they just weren't
  wired together in the UI). If a contract exists, shows value/dates/scope/terms with edit
  (locked base value once the contract leaves `draft`, matching the API's own guard) and a status
  dropdown that reuses the server's transition state machine — same role gate as the old
  `/contracts` page (admin/ceo/manager).
- **Billing tab** (`/projects/[id]`): full invoice create/list/mark-sent/mark-paid/cancel, scoped
  to the project's client with **no client or project picker** — both are implicit from the
  project record itself, which is a strictly *shorter* flow than the general Billing page (which
  requires picking a client, then optionally a project). Same role gate as the old `/billing` page
  (admin/ceo/accountant).
- **Sidebar** is now 8 top-level items (down from the original 15): Dashboard, Projects, People,
  Equipment, Finance, Documents, AI Assistant, Users. Contracts, Billing, Materials, Tasks,
  Attendance, Clients, Vendors, and Employees are no longer separate nav rows — they're reached
  through Projects or People. All their routes still resolve directly (no deep links broken).
- **Backend automation** (the explicit "maintain it if it doesn't need user intervention" ask):
  `sweepOverdueInvoices()` (`src/lib/invoice-overdue.ts`) persists the `overdue` status that was
  previously only computed at request time and shown in the UI, never saved — meaning
  `/api/invoices/stats` and anything else querying the stored `status` field silently disagreed
  with the invoice list. It now runs daily alongside the equipment job-costing sweep via the
  combined `/api/cron/daily-jobs` endpoint. Confirmed working end-to-end against seeded data: the
  first live run found and correctly flagged **7** invoices that were `sent` and past due.
- Verified with a full production build (`npm run build`) — zero errors, zero new warnings (fixed
  one `react-hooks/exhaustive-deps` warning introduced by `salary-history.tsx` along the way) —
  plus authenticated `curl` smoke tests confirming `/people`, `/projects/[id]`, and
  `/api/cron/daily-jobs` all return 200 with correct data and no error markers.

### Subcontractors (Contract tab)
`/api/subcontracts` had full CRUD (create/list/update/delete, project-boundary checks for
managers) but **no UI anywhere in the app** — it was dead, unreachable backend code. The Contract
tab on `/projects/[id]` now has a "Main Contract" / "Subcontractors" toggle:
- **Main Contract** — the existing client-facing contract (unchanged from P6).
- **Subcontractors** — a separate, unlimited-per-project list for work outsourced to an outside
  vendor (electrical, plumbing, etc.). Distinct from the main contract because it's a different
  relationship: one client contract vs. many possible subcontractor agreements, each tied to a
  `Vendor` record (reusing the same vendor directory from People, no new picker/entity needed) with
  its own value, scope, and dates.
- `GET /api/projects/[id]` now also returns `subcontracts` (populated with vendor info), alongside
  the existing `contract`/`invoices`/`ledgerEntries`, so the whole project page stays on one fetch
  + `mutate()` pattern.
- Verified end-to-end with authenticated `curl`: created a subcontract (201), confirmed it appears
  in the project payload, updated its value/notes (200), deleted it (200) — all through the actual
  API the UI calls, no bugs found.
