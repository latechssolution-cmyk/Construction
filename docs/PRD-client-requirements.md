# PRD — Client Requirements Integration (Construction ERP)

**Status:** ✅ Implemented (verify + handover)
**Author:** LA Tech Solutions
**Source:** Client guideline document `Const Company Software - Guidline.docx`
**Context:** Final feature integration before project handover.

---

## 1. Background

The client is a construction **contracting** company (public-sector / tender-based
work — terminology: BOQ, CA value, IPCs, tender notices, guarantees). The existing
ERP already covers Projects, People (Clients/Vendors/Employees/Attendance/Payroll),
Equipment, Finance (Ledger/Accounts/Payments/Profit Sheets), Documents, Billing and
Users. This PRD captures the **additions and changes** the client asked for and how
they map onto the existing system.

The client document specifies three things:

1. A **portfolio Dashboard** with a precise set of widgets (projects, finances,
   staff, equipment, assets) and an **Active Projects** table.
2. A structured **tender/contract document set** per project, plus **project
   detail** fields (salients, CA details, budget, resources, expenses, progress).
3. **Notes**: invoices listed under their own head *and* inside each project;
   documents listed globally *and* per project; access for partners/managers
   separated and limited by project status.

---

## 2. Scope decisions

| # | Decision point | Choice | Rationale |
|---|---|---|---|
| D1 | Depth of **Work Done / BOQ** tracking | **Invoices-as-IPCs.** "Signed BOQ" is an uploaded document. *Work Done* = cumulative value certified via project Invoices (running bills / IPCs). *Progress %* stays task-derived. | Faithful to how contractors actually bill (IPC = interim payment certificate); reuses the existing invoice engine; avoids a multi-week BOQ measurement module that would be fragile at handover. |
| D2 | **Assets vs Equipment** | **Separate Asset register** with **straight-line depreciation** → Current Book Value. Equipment stays the operational view. | Client lists Assets and Equipment as distinct dashboard sections with distinct semantics (book value, depreciation, maintenance-due). Straight-line is the standard, predictable method. |
| D3 | **Partner role** | **No new role.** Rely on existing Manager project-scoping. | Keeps the auth model simple for handover; manager scoping was hardened this cycle. "Access limited per status" is met by (a) managers only seeing assigned projects and (b) blocking edits to terminal-status projects. |

---

## 3. Definitions (single source of truth for dashboard math)

All money in **PKR**.

| Metric | Definition |
|---|---|
| **CA Value** (per project) | `project.caValue` — the Contract Agreement value awarded for the project. Falls back to `budget` if unset. |
| **Total Contract Value** | Σ `caValue` over all non-cancelled projects. |
| **Work Done** (per project) | Σ `invoice.subtotal` over that project's invoices with status ∈ {sent, paid, overdue} (i.e. actually submitted/certified; drafts excluded). Gross value of work billed. |
| **Payment Received** (per project) | Σ `ledgerEntry.amount` where `type = income` and `projectId` = project. Actual cash received. |
| **Progress %** (per project) | `project.completionPercent` — weighted task completion (already task-derived, single source of truth). |
| **Total Revenue Earned** | Σ all `income` ledger entries (all-time). |
| **Total Expenses** | Σ all `expense` ledger entries, excluding `inventory_asset` (which is a balance-sheet move, not a P&L cost). |
| **Gross Profit** | Total Revenue Earned − Total Expenses. |
| **Cash in Bank** | Σ `bankAccount.balance` over active accounts. |
| **Accounts Receivable (AR)** | Σ (`invoice.grandTotal − invoice.paidAmount`) over invoices with status ∈ {sent, overdue}. Money clients owe us for submitted, unpaid bills. |
| **Accounts Payable (AP)** | Open subcontractor commitments = Σ `subcontract.contractValue` for `status = in_progress`, minus subcontractor-category expenses already paid; clamped ≥ 0. (The ledger is cash-basis, so subcontracts are the only modelled accrued obligation.) Labelled "Open commitments" for honesty. |
| **Gross Salary (active)** | Σ `employee.salary` over `isActive = true` employees. |
| **Total Equipment (No & Cost)** | count of equipment; Σ `purchasePrice`. |
| **Working / Idle Equipment** | Working = status `in_use`; Idle = status `available`. |
| **Total Assets / Value** | count of assets; Σ `purchaseCost`. |
| **Current Book Value** | Σ per-asset straight-line book value = `purchaseCost − accumulatedDepreciation`, where `accumulatedDepreciation = min((purchaseCost − salvageValue) × age_years / usefulLifeYears, purchaseCost − salvageValue)`. |
| **Idle / Under Maintenance Assets** | count where status ∈ {idle, under_maintenance}. |
| **Assets Due Maintenance** | count where `nextMaintenanceDate ≤ today`. |

---

## 4. Project status taxonomy (breaking change)

The client's dashboard requires these project buckets. New `Project.status` enum:

| New status | Meaning | Migrated from |
|---|---|---|
| `planning` | Pre-award / tendering / bidding | `planning` |
| `ongoing` | Awarded, under execution | `in_progress` |
| `physically_closed` | Construction complete; financial settlement (final bill / retention) pending | (subset of `completed`) |
| `financially_closed` | Fully settled — all payments received, retention released | `completed` |
| `sick` | Distressed / stalled / problem project | `on_hold` |
| `cancelled` | Cancelled / terminated | `cancelled` |

Touchpoints: `Project` model, projects API validation, projects list filter,
project detail status control, dashboard status buckets, `getStatusColor`,
`StatusBadge`, seed data.

---

## 5. Feature specifications

### 5.1 Dashboard (admin/ceo)
Rebuild `/api/dashboard/admin` + dashboard UI into these sections:

- **Projects** — 5 status cards (Total, Ongoing, Physically Closed, Financially
  Closed, Sick), each showing **No & Cost** (count + Σ CA value), plus a bar chart
  of count-by-status and cost-by-status.
- **Finances** — cards: Total Contract Value, Total Revenue Earned, Total Expenses,
  Gross Profit, Cash in Bank, Accounts Receivable, Accounts Payable; plus the
  existing 6-month revenue-vs-expense chart.
- **Staff** — Total Employee, Active Employee, Gross Salary (active).
- **Equipment** — Total (No & Cost), Working, Idle.
- **Assets** — Total Assets, Total Assets Value, Current Book Value, Idle/Under
  Maintenance, Due Maintenance.
- **Active Projects table** — columns: Project Name · CA Value · Work Done ·
  Progress % · Payment Received. Each row links to the project.

Every card links to its underlying list where one exists.

### 5.2 Assets module (new)
`Asset` model: `name, assetCode, category (land|building|vehicle|machinery|
it_equipment|furniture|other), purchaseDate, purchaseCost, usefulLifeYears,
salvageValue, status (in_use|idle|under_maintenance|disposed), location,
lastMaintenanceDate, nextMaintenanceDate, notes`. Book value & accumulated
depreciation are **computed** (straight-line), never stored. CRUD API + `/summary`.
New `/assets` page + sidebar entry. Registered in `mongoose.ts`. Seeded.

### 5.3 Project tender/contract documents
Add `category` to `Document` with the tender taxonomy:
`tender_notice, tender_documents, prebid_meeting, submitted_bid, bid_comparative,
work_order, signed_boq, contract_agreement, guarantee_bid, guarantee_mobilization,
guarantee_performance, general`. The project detail **Documents** tab becomes a
category checklist (each slot shows uploaded doc(s) + upload button). Global
`/documents` page gains a category filter/column. Guarantees are handled as the
three guarantee categories (kept as documents; structured expiry tracking noted as
a future enhancement).

### 5.4 Project detail additions
Add to `Project`: `caValue` (number), `salients` (text). Surface both on the
Overview tab (CA Value alongside budget; Salients as a described block). Budget,
manpower/equipment resources, expenses and progress already exist on their
respective tabs.

### 5.5 Invoices & documents surfacing (client notes)
- Invoices already have a global head (`/billing`) and a per-project **Billing**
  tab — ensure `/billing` is reachable from the nav (Finance group) and each
  invoice shows inside its project. ✔ mostly present; verify.
- Documents listed globally (`/documents`) and per-project (Documents tab). ✔
  present; enhanced with categories.

### 5.6 Access per status (client note)
No new role. Managers see only assigned projects (done). Additionally: managers
cannot **edit** projects in terminal status (`financially_closed`, `cancelled`).

---

## 6. Implementation phases

1. **Data model** — Project status/caValue/salients; Document category; Asset model;
   register Asset in mongoose.ts.
2. **Backend** — Assets CRUD + summary; dashboard/admin rewrite; projects API status
   validation; documents API category.
3. **Frontend** — dashboard rebuild; `/assets` page; project Overview (CA/Salients)
   + Documents-as-checklist tab; projects list status filter/badges; documents
   category filter; nav (Assets + Finance→Billing).
4. **Data + verify** — update `seed.ts`; re-seed; `tsc` + `build`; live-verify each
   dashboard section and new page; finalize this PRD.

---

## 6b. Implementation summary (what shipped)

| Area | Files |
|---|---|
| Project status taxonomy + CA value + salients | `models/Project.ts`, `api/projects/route.ts`, `api/projects/[id]/route.ts`, projects list + detail pages, `lib/utils.ts` (getStatusColor) |
| Asset register + straight-line depreciation | `models/Asset.ts`, `api/assets/route.ts`, `api/assets/[id]/route.ts`, `app/(dashboard)/assets/page.tsx`, `lib/mongoose.ts` |
| Document categories + tender checklist | `lib/document-categories.ts`, `models/Document.ts`, `api/documents/*`, global documents page, project Documents tab |
| Dashboard rebuild | `api/dashboard/admin/route.ts`, `app/(dashboard)/dashboard/page.tsx` (AdminDashboard) |
| Nav (Assets + Invoices head) | `components/layout/sidebar.tsx` |
| Access per status | manager terminal-status edit guard in `api/projects/[id]/route.ts` |
| Seed data | `scripts/seed.ts` (statuses, caValue, salients, 12 assets, tender-doc checklist per project) |

**Manager/Accountant dashboards** were left intact (separate endpoints) — only the
Admin/CEO dashboard was rebuilt to the client's portfolio spec.

## 7. Out of scope / future enhancements
- Full BOQ line-item measurement engine (chose invoices-as-IPCs instead).
- Structured guarantee tracking with amount + expiry alerts (currently document
  categories).
- Accrual-based Accounts Payable with a vendor-bill model (currently derived from
  subcontract commitments).
- A dedicated `partner` user role with per-project access lists.
