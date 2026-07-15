# PRD — Authorization & Financial Confidentiality Audit

**Project:** Construction ERP (Next.js 15 + MongoDB)
**Date:** 2026-07-14
**Status:** Findings + proposed changes — awaiting owner decisions (see §6)

---

## 1. Purpose

Audit every role's access across all API routes and UI pages, verify it against the intended
authorization model, and list required changes. Special focus: **company-wide income /
profit / cash figures are confidential** — they must be visible to Admin and CEO only, not to
the Project Manager or the Accountant. Also audited: **project-wise display of income,
budget, and profit**.

Every claim below was verified directly against the source code (not just sampled).

## 2. Intended authorization model (target state)

| Role | Intent |
|---|---|
| **Admin (super admin)** | Everything, including user management. |
| **CEO** | Everything (same visibility as Admin). |
| **Manager** | Runs *assigned* projects: tasks, phases, materials, team, equipment, documents, subcontracts. Sees project **budget and spend** (needed to run the job) but **not income, revenue, or profit** — not even for their own projects, and never company-wide. |
| **Accountant** | Operates finance day-to-day: records ledger entries/payments, manages invoices & liabilities, payroll, bank transactions, loans. **Does not see company-wide aggregates** (total income, total expense, gross/net profit, total cash position) — those are executive-only. |

> The exact confidentiality line for the Accountant is the main open decision — an
> accountant who can list every ledger entry can always sum them offline. See Decision D1.

## 3. Current-state authorization matrix (verified)

### 3.1 API routes — who can call what

Legend: A=admin, C=ceo, M=manager, X=accountant, ✱=any authenticated role.
"M-scoped" = manager restricted to projects where `assignedManagerId` = their user id.

| Module | GET (read) | POST/PUT/DELETE (write) | M-scoped? | Notes |
|---|---|---|---|---|
| `/api/users`, `/api/audit` | A,C | A (writes) | — | Also enforced in `middleware.ts`. |
| `/api/dashboard/admin` | A,C | — | — | Full company P&L, cash, AR/AP, salaries, liabilities. |
| `/api/dashboard/accountant` | A,C,X | — | — | **Company-wide** income/expense (all-time + month), cash, bank balances, AR/AP, loans, liabilities, asset book value. |
| `/api/dashboard/manager` | M | — | ✅ | CA value, budget, spent — assigned projects only. No income/profit. |
| `/api/ledger`, `/summary`, `/[id]` | A,C,X | A,C,X (DELETE A only) | — | Summary returns company **net profit** by year/category. Global query (projectId optional). |
| `/api/payments` | A,C,X | A,C,X (DELETE A,C) | — | |
| `/api/invoices` (+items, stats, pdf) | A,C,X | A,C,X (DELETE A,C) | — | Stats = company-wide invoiced/paid/pending totals. |
| `/api/liabilities` (+stats, [id]) | A,C,X | A,C,X | — | |
| `/api/loans` (+repayments) | A,C,X | A,C,X (write-off A,C) | — | |
| `/api/bank-accounts` | list: ✱ (non-finance get names only); detail/statement: A,C,X | A,C | — | Accountant sees full balances & account numbers. |
| `/api/investments` | A,C,X (M with projectId) | A,C,X (detail writes A,C) | ✅ | |
| `/api/employees/[id]/salary` | A,C,X | A,C,X | — | Salary detail + payroll run. |
| `/api/projects` list | ✱ (M auto-filtered) | POST A,C,M | ✅ list | **Returns `actualRevenue`, `actualExpense`, `actualProfit` per project to managers.** |
| `/api/projects/[id]` detail | ✱ (M must own) | PUT A,C,M / DELETE A,C | ✅ | **Returns last 50 ledger entries (income+expense) and all invoices to managers.** |
| `/api/projects/[id]/summary` | ✱ (M must own) | — | ✅ | **Returns `income`, `expense`, `profit` to managers.** |
| `/api/projects/[id]/report` (PDF) | ✱ (M must own) | — | ✅ | **PDF includes Total Income / Total Expense / Net Profit + full ledger table.** |
| `/api/projects/[id]/stock` | ✱ | — | ❌ | requireAuth only. |
| `/api/tasks`, `/milestones`, `/phases` | ✱ (tasks list M-filtered) | A,C,M | partial | Task/milestone detail writes gated A,C,M. |
| `/api/materials`, `/material-usage` | ✱ / A,C,M | A,C,M | ✅ create | Material create posts expense ledger + bank debit. |
| `/api/contracts` (+variations) | **✱ (list & detail)** | POST A,C,M; variations A,C; DELETE A,C | detail ✅ | **Contract values readable by any role incl. accountant & manager.** |
| `/api/subcontracts` | **✱** | A,C,M | ✅ create | Subcontract values readable by any role. |
| `/api/vendors`, `/clients`, `/partners` | **✱** | vendors/clients A,C,M; partners A,C | — | Contact books readable by all roles. |
| `/api/employees` list/detail | **✱** | A,C,M (DELETE A) | — | No salary amount in list, but `salaryType` present. |
| `/api/equipment`, `/assets`, `/store` | **✱** | equip A,C,M; assets A,C,X; store A,C | — | Purchase prices / book values readable by all roles. |
| `/api/export` | invoices/ledger: A,C,X · others: A,C,M | — | ❌ | **Accountant can export the global ledger & all invoices to CSV (projectId optional).** |
| `/api/ai-chat` | — | **✱ (POST)** | — | requireAuth only; no role check (UI hides it from accountant, API doesn't). |
| `/api/search` | ✱ | — | ✅ | Manager-scoped correctly. |
| `/api/notifications`, `/upload`, `/users/assignable`, `/documents` | ✱ (documents detail: owner/A,C + M-scoped) | | | Low sensitivity. |
| `/api/cron/*` | CRON_SECRET or A,C | | — | |
| `/api/settings` | ✱ | A,C | — | Exposes tax defaults only. |

### 3.2 UI pages — who sees what

| Page | View gate | Money shown |
|---|---|---|
| `/dashboard` | all roles (renders per-role component) | Admin/CEO: full P&L, cash, AR/AP, loans, liabilities, salaries. **Accountant: company-wide cash position, month+total income/expense, AR/AP, loans, liabilities, asset value.** Manager: CA value/budget/spent of own projects only. |
| `/projects` list | **no view gate** (sidebar hides from X, but URL works) | Budget per project. `canManage` gates buttons to A,C,M. |
| `/projects/[id]` | **no view gate**; API blocks non-assigned managers | **"Net Profit" header stat + Total Income / Net Profit cards in Finance tab — visible to managers** (and accountant). Contract tab shows contract value + variations. Report tab downloads P&L PDF. |
| `/billing` (invoices) | A,C,X | Company totals: Total Paid / Pending / Total Invoiced. |
| `/finance/ledger` | A,C,X | Company Total Income / Expense / Net Balance. |
| `/finance/accounts` | A,C,X (manage A,C) | All bank balances + account numbers + statements. |
| `/finance/payments` | A,C,X | Company Money In / Out / Net Flow. |
| `/finance/loans` | A,C,X (write-off A,C) | Company loan totals. |
| `/finance/liabilities` | A,C,X | Company liability totals. |
| `/finance/profit-sheets` | A,C,X | **Company Total Revenue / Expenses / Net Profit / margin + per-project profit table.** |
| `/people` | all roles; Salary tab A,C,X; Partners tab A,C,X | Salary history (A,C,X). Partner equity %. |
| `/contracts` | canManage A,C,M (**accountant not gated out of viewing**) | Contract values. |
| `/assets` | A,C,X | Purchase cost + book value totals. |
| `/equipment`, `/store` | all roles per sidebar | Equipment purchase prices. |
| `/ai-assistant` | sidebar: A,C,M | Chat (no ERP data injection today). |
| `/admin/users` | A,C | — |

Sidebar (`components/layout/sidebar.tsx`): Manager gets Dashboard, Projects, People,
Equipment, Store, Documents, AI Assistant. Accountant gets Dashboard, People, Assets,
Store, Finance (7 sub-items), Documents. **Sidebar hiding is cosmetic — old routes still
resolve by URL, so the page-level and API-level gates are the real control.**

## 4. Findings

### 4.1 What is already correct ✅

1. Manager is blocked (page-gate + API role check) from all `/finance/*` pages, billing,
   salary tab, loans, liabilities, bank accounts, profit sheets.
2. Manager dashboard is correctly scoped to assigned projects and does **not** include
   income or profit — only CA value, budget, spent.
3. Manager project scoping (`assignedManagerId` filter + `assertManagerOwnsProject`) is
   consistently applied on project list, detail, summary, report, investments, materials,
   tasks list, search, and contract detail.
4. Middleware blocks `/api/users` and `/api/audit` to admin/ceo; salary detail API is A,C,X.
5. Money-mutating writes are transactional and role-gated (invoices, ledger, payments,
   loans, liabilities, payroll).
6. Financial audit-log entries are finance-role-gated; user/employee audit trails admin/ceo.

### 4.2 Violations of the confidentiality requirement 🚨

**F1 — Accountant sees full company P&L (HIGH, by design today).**
Where: `/api/dashboard/accountant` (totalIncome/totalExpense/monthly + cash position),
`/finance/profit-sheets` + `/api/ledger/summary` (net profit, margin, per-project profit),
`/finance/ledger` header totals, `/api/invoices/stats` (total invoiced/paid = revenue),
payments Net Flow, loans/liabilities/assets totals, all bank balances.
→ Directly contradicts "income shouldn't be shown to the accountant". See **D1** — the fix
is a policy split between *transactional* access (needed to do the job) and *aggregate*
P&L access (executive-only).

**F2 — Manager sees project income & profit for assigned projects (HIGH).**
- `/api/projects` list returns `actualRevenue / actualExpense / actualProfit` per project
  (`src/app/api/projects/route.ts:64-66`).
- `/api/projects/[id]/summary` returns `income / expense / profit`; rendered as the
  **"Net Profit"** header stat with "Inc: …" subtitle on the project page (line ~891) and
  as **Total Income / Net Profit** cards in the Finance tab (lines ~1015-1017, ~2091-2099).
- `/api/projects/[id]` returns the last 50 ledger entries (incl. income rows) and the
  project's invoices to a manager.
- `/api/projects/[id]/report` PDF prints Total Income / Total Expense / Net Profit and the
  full ledger table.
→ Contradicts "project manager shouldn't see income". Budget & spend are fine; income,
revenue, and profit are not. See **D2**.

**F3 — List endpoints readable by every authenticated role (MEDIUM).**
`/api/contracts` (contract values!), `/api/subcontracts` (commitment values),
`/api/vendors`, `/api/clients`, `/api/partners`, `/api/employees`, `/api/equipment`
(purchase prices), `/api/assets` (book values) have `requireAuth()` but no `requireRole()`
on GET. Sidebar hides the pages, but the API (and direct URLs like `/contracts`) leak:
- Accountant can read every contract/subcontract value (revenue-side data).
- Manager can read assets/equipment purchase costs and all partner records.
See **D3/D4**.

**F4 — Export lets the accountant dump global financial data (MEDIUM).**
`/api/export?module=ledger|invoices` allows A,C,X with `projectId` optional → full-company
CSV. Consistent with F1 today; must follow whatever D1 decides.

**F5 — `/api/ai-chat` has no role check (LOW today, HIGH if data-connected).**
Any authenticated role (incl. accountant, who doesn't even see the page) can POST. The
assistant currently has no ERP data injection, so nothing leaks yet — but any future
"answer from live data" feature would bypass every gate above. Gate it now (**D6**).

**F6 — UI pages without view gates, reachable by URL (LOW-MEDIUM).**
`/projects` and `/projects/[id]` render for an accountant (shows budgets, Net Profit stat);
`/contracts` renders for an accountant. Equipment/store pages render for everyone. The
data comes from the APIs in F3, so fixing the APIs mostly fixes this; page gates should
match for defense-in-depth.

### 4.3 Hygiene gaps (not confidentiality) ⚠️

- `/api/projects/[id]/stock`: `requireAuth` only — any role can read any project's
  material stock (no manager scoping). Low sensitivity, inconsistent scoping.
- `/api/tasks/[id]` and `/api/milestones/[id]` writes are gated A,C,M but not
  project-scoped for managers (a manager can edit a task on someone else's project by id).
- `salaryType` is included in the any-role `/api/employees` list response.
- Employee PUT/DELETE: gated (A,C,M / A), but managers can edit employees globally, not
  just their project team.

## 5. Project-wise income / budget display (explicit check requested)

| Figure | Admin/CEO | Manager (own projects) | Accountant | Target |
|---|---|---|---|---|
| Budget | ✅ list, detail, dashboard | ✅ | ✅ via URL (F6) | Manager ✅ keep; Accountant — D5 |
| Spent / budget-used % | ✅ | ✅ | ✅ via URL | Keep for manager (needed to run job) |
| CA / contract value | ✅ | ✅ (list, detail, contract tab) | ✅ via API (F3) | D3 |
| Project income (payments received) | ✅ | ⚠️ **visible** (summary API, Finance tab, ledger rows, PDF) | ✅ | **Hide from manager** (D2) |
| Project profit / margin | ✅ | ⚠️ **visible** ("Net Profit" header stat, Finance tab, PDF, list API) | ✅ (profit-sheets, project page) | **Hide from manager**; Accountant per D1 |
| Project invoices | ✅ | ⚠️ visible in project Billing tab | ✅ | D2 (invoice amounts ≈ revenue) |

## 6. Decision points (owner input needed) 🔑

**D1 — Where is the accountant's confidentiality line?**
An accountant must *record* transactions, so they will always see individual amounts.
Choose one:
- **(a) Recommended:** Accountant keeps transactional screens (ledger list, payments,
  invoices, liabilities, loans, payroll, bank statements) but loses **aggregates**:
  dashboard income/expense/cash cards, profit-sheets page, ledger summary totals,
  invoice-stats totals, "net flow" cards, global CSV exports. Their dashboard becomes
  work-queue oriented (pending invoices, unpaid liabilities, today's entries).
- **(b)** Accountant loses even transactional *income* visibility (can record expenses
  only; income entries admin/ceo-recorded) — heavier operational cost.
- **(c)** Keep as-is and accept the accountant as a trusted finance role (contradicts your
  stated requirement).

**D2 — What exactly may a manager see on their own projects?**
Recommended: budget, spent, budget-used %, material costs, subcontract commitments —
**no income, no profit, no invoice amounts, no income ledger rows, no P&L in the PDF
report**. Confirm whether:
- Manager keeps the project **Billing tab** (invoice list) at all, or loses it entirely.
- The **PDF report** for managers should be a budget/progress report (no income section)
  or admin/ceo-only.
- Manager keeps **CA/contract value** (they create contracts today — see D3).

**D3 — Contracts: who creates and who sees values?**
Today managers create contracts and see values; accountants can read them via API only.
Decide: (a) manager keeps contract create + value visibility for assigned projects
(recommended — they negotiate scope), or (b) contract values become A,C-only and managers
see contracts without the money fields.

**D4 — Reads on shared registries (vendors, clients, partners, employees, equipment,
assets, store).** Recommended minimum: partners (investor equity) → A,C,X only; assets
book values → A,C,X (already page-gated, gate API too); equipment purchase price hidden
from manager list view or accepted as operational data. Confirm which registries managers
genuinely need (vendors/clients likely yes for operations).

**D5 — Should the accountant see project budgets / the projects module at all?**
Currently reachable by URL only. Options: give accountant read-only Projects access
(useful for coding expenses to projects) or block the pages entirely.

**D6 — AI assistant:** restrict `/api/ai-chat` to admin/ceo/manager (matching the sidebar),
or admin/ceo only? Must be decided *before* any ERP-data-aware assistant feature ships.

**D7 — Bank account numbers:** should the accountant see full account numbers, or masked
(····1234) with full numbers A,C-only?

**D8 — Salary visibility for payroll:** accountant currently runs payroll and sees full
salary detail. Keep (recommended — payroll is their job) or restrict payroll to admin/ceo?

## 7. Proposed implementation (after decisions)

Ordered, file-level. Items marked ⭐ are recommended regardless of decisions.

1. ⭐ **Strip income/profit from manager-facing project APIs** (F2):
   - `projects/route.ts`: omit `actualRevenue/actualExpense/actualProfit` when role=manager.
   - `projects/[id]/summary/route.ts`: omit `income/profit` (keep budget/spent) for manager.
   - `projects/[id]/route.ts`: for manager, filter `ledgerEntries` to expenses only and
     omit `invoices` (per D2).
   - `pdf-generator.ts` / `report/route.ts`: manager variant without P&L section (per D2).
   - `projects/[id]/page.tsx`: role-conditional rendering of Net Profit stat, Finance-tab
     income/profit cards, Billing tab.
2. ⭐ **Gate `/api/ai-chat`** with `requireRole` per D6.
3. **Accountant aggregate removal** per D1(a): rework `dashboard/accountant/route.ts` +
   `AccountantDashboard`, gate `profit-sheets` page + `ledger/summary` + `invoices/stats`
   to A,C; require `projectId` or restrict `/api/export` financial modules to A,C.
4. **Add `requireRole` to registry GETs** per D3/D4 (contracts, subcontracts, partners,
   assets, equipment, vendors, clients, employees) and matching page view-gates (F6).
5. ⭐ **Hygiene**: manager-scope task/milestone detail writes and `projects/[id]/stock`;
   drop `salaryType` from the open employees list.
6. **Verification**: per-role API sweep (repeat of this audit's method) + UI walkthrough
   with the four seeded accounts; add the role matrix to the repo docs as the source of
   truth for future routes.

## 8. Verification method used for this audit

- Static sweep: every `route.ts` under `src/app/api/**` mapped `requireAuth`/`requireRole`
  per HTTP method (awk/grep, no sampling).
- Frontend sweep: every `page.tsx` under `src/app/(dashboard)/**` checked for role gates
  and rendered money figures; sidebar NAV roles enumerated.
- Cross-checked three independent audit passes; discrepancies resolved by reading the
  actual code (e.g., task/milestone writes ARE role-gated; earlier draft claimed otherwise).
