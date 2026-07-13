import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Employee from "@/models/Employee";
import LedgerEntry from "@/models/LedgerEntry";
import AuditLog from "@/models/AuditLog";
import Task from "@/models/Task";
import Invoice from "@/models/Invoice";
import BankAccount from "@/models/BankAccount";
import Equipment from "@/models/Equipment";
import Subcontract from "@/models/Subcontract";
import Asset from "@/models/Asset";

// Effective CA value expression: use caValue when set, else fall back to budget.
const CA_VALUE_EXPR = { $cond: [{ $gt: ["$caValue", 0] }, "$caValue", "$budget"] };

const PROJECT_STATUSES = ["planning", "ongoing", "physically_closed", "financially_closed", "sick", "cancelled"];

export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    await connectDB();

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      projectStatusAgg, ledgerTotalsAgg, contractValueAgg,
      bankAgg, arAgg, openSubcontractsRaw,
      staffAgg, equipmentAgg, assetsRaw,
      trendAgg, recentActivity, overdueTasks, overdueInvoices,
    ] = await Promise.all([
      // Projects grouped by status → count + Σ effective CA value
      Project.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 }, cost: { $sum: CA_VALUE_EXPR } } },
      ]),
      // All-time income + expense (expense excludes inventory_asset balance moves)
      LedgerEntry.aggregate([
        { $group: { _id: null, income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } }, expenseExclAsset: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "expense"] }, { $ne: ["$category", "inventory_asset"] }] }, "$amount", 0] } } } },
      ]),
      // Total contract value across non-cancelled projects
      Project.aggregate([
        { $match: { status: { $ne: "cancelled" } } },
        { $group: { _id: null, total: { $sum: CA_VALUE_EXPR } } },
      ]),
      // Cash in bank
      BankAccount.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, total: { $sum: "$balance" } } },
      ]),
      // Accounts receivable = billed but unpaid (sent + overdue)
      Invoice.aggregate([
        { $match: { status: { $in: ["sent", "overdue"] }, deletedAt: null } },
        { $group: { _id: null, total: { $sum: { $subtract: ["$grandTotal", { $ifNull: ["$paidAmount", 0] }] } } } },
      ]),
      // Open subcontract commitments (for AP)
      Subcontract.find({ status: "in_progress" }, { contractValue: 1, projectId: 1, vendorId: 1 }).lean(),
      // Staff: totals + gross salary of active employees
      Employee.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, active: { $sum: { $cond: ["$isActive", 1, 0] } }, grossSalary: { $sum: { $cond: ["$isActive", "$salary", 0] } } } },
      ]),
      // Equipment: count + cost + working/idle
      Equipment.aggregate([
        { $group: { _id: null, total: { $sum: 1 }, cost: { $sum: { $ifNull: ["$purchasePrice", 0] } }, working: { $sum: { $cond: [{ $eq: ["$status", "in_use"] }, 1, 0] } }, idle: { $sum: { $cond: [{ $eq: ["$status", "available"] }, 1, 0] } } } },
      ]),
      // Assets: fetched lean; book value (straight-line) computed in JS
      Asset.find({}, { purchaseCost: 1, salvageValue: 1, usefulLifeYears: 1, purchaseDate: 1, status: 1, nextMaintenanceDate: 1 }).lean(),
      LedgerEntry.aggregate([
        { $match: { date: { $gte: sixMonthsAgo } } },
        { $group: { _id: { year: { $year: "$date" }, month: { $month: "$date" }, type: "$type" }, total: { $sum: "$amount" } } },
      ]),
      AuditLog.find({}, { action: 1, module: 1, recordId: 1, details: 1, createdAt: 1 })
        .populate("user", "name").sort({ createdAt: -1 }).limit(8).lean({ virtuals: true }),
      Task.countDocuments({ status: { $ne: "completed" }, dueDate: { $lt: now } }),
      Invoice.countDocuments({ status: { $in: ["sent", "overdue"] }, dueDate: { $lt: now }, deletedAt: null }),
    ]);

    // ── Projects section ────────────────────────────────────────────────────
    const statusMap: Record<string, { count: number; cost: number }> = {};
    for (const s of PROJECT_STATUSES) statusMap[s] = { count: 0, cost: 0 };
    let totalCount = 0, totalCost = 0;
    for (const r of projectStatusAgg as any[]) {
      const key = r._id || "planning";
      statusMap[key] = { count: r.count, cost: r.cost || 0 };
      totalCount += r.count; totalCost += r.cost || 0;
    }
    const projects = {
      total: { count: totalCount, cost: totalCost },
      ongoing: statusMap.ongoing,
      physically_closed: statusMap.physically_closed,
      financially_closed: statusMap.financially_closed,
      sick: statusMap.sick,
      planning: statusMap.planning,
      cancelled: statusMap.cancelled,
      byStatusChart: PROJECT_STATUSES.map((s) => ({ name: s.replace(/_/g, " "), count: statusMap[s].count, cost: statusMap[s].cost })),
    };

    // ── Finances section ────────────────────────────────────────────────────
    const totalRevenue = (ledgerTotalsAgg as any[])[0]?.income || 0;
    const totalExpense = (ledgerTotalsAgg as any[])[0]?.expenseExclAsset || 0;
    const totalContractValue = (contractValueAgg as any[])[0]?.total || 0;
    const cashInBank = (bankAgg as any[])[0]?.total || 0;
    const accountsReceivable = Math.max(0, (arAgg as any[])[0]?.total || 0);
    const openSubcontracts = (openSubcontractsRaw as any[]).reduce((sum, s) => sum + (s.contractValue || 0), 0);
    // Only net off payments made against the *currently open* subcontracts —
    // summing every subcontractor/vendor_payment ledger entry ever recorded
    // (including ones tied to subcontracts that finished long ago) would
    // make this figure grow without bound while openSubcontracts shrinks as
    // work completes, eventually flooring AP at 0 even with real payables
    // outstanding. LedgerEntry doesn't reference a specific subcontract, so
    // this matches on (project, vendor) pairs — the closest available proxy.
    const subcontractorPaid = openSubcontractsRaw.length === 0 ? 0 : (
      (await LedgerEntry.aggregate([
        {
          $match: {
            type: "expense",
            category: { $in: ["subcontractor", "vendor_payment"] },
            $or: (openSubcontractsRaw as any[]).map((s) => ({ projectId: s.projectId, vendorId: s.vendorId })),
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]))[0]?.total || 0
    );
    const accountsPayable = Math.max(0, openSubcontracts - subcontractorPaid);
    const finances = {
      totalContractValue, totalRevenue, totalExpense,
      grossProfit: totalRevenue - totalExpense,
      cashInBank, accountsReceivable, accountsPayable,
    };

    // ── Staff / Equipment / Assets ──────────────────────────────────────────
    const staffRow = (staffAgg as any[])[0] || {};
    const staff = { totalEmployees: staffRow.total || 0, activeEmployees: staffRow.active || 0, grossSalary: staffRow.grossSalary || 0 };

    const eqRow = (equipmentAgg as any[])[0] || {};
    const equipment = { total: eqRow.total || 0, totalCost: eqRow.cost || 0, working: eqRow.working || 0, idle: eqRow.idle || 0 };

    let assetTotalValue = 0, assetBookValue = 0, assetIdleMaint = 0, assetDueMaint = 0;
    for (const a of assetsRaw as any[]) {
      const cost = a.purchaseCost || 0;
      const salvage = Math.min(a.salvageValue || 0, cost);
      const life = a.usefulLifeYears || 0;
      let book = cost;
      if (life > 0 && a.purchaseDate) {
        const ageYears = Math.max(0, (Date.now() - new Date(a.purchaseDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        const dep = Math.min(((cost - salvage) * ageYears) / life, cost - salvage);
        book = cost - dep;
      }
      assetTotalValue += cost;
      assetBookValue += book;
      if (["idle", "under_maintenance"].includes(a.status)) assetIdleMaint++;
      if (a.nextMaintenanceDate && new Date(a.nextMaintenanceDate) <= now && a.status !== "disposed") assetDueMaint++;
    }
    const assets = {
      total: (assetsRaw as any[]).length,
      totalValue: assetTotalValue,
      bookValue: Math.round(assetBookValue),
      idleOrMaintenance: assetIdleMaint,
      dueMaintenance: assetDueMaint,
    };

    // ── Active Projects table ───────────────────────────────────────────────
    const activeStatusFilter = { status: { $in: ["ongoing", "physically_closed", "sick"] } };
    const ACTIVE_PROJECTS_LIMIT = 50;
    const [activeProjectsTotalCount, activeProjectDocs] = await Promise.all([
      Project.countDocuments(activeStatusFilter),
      Project.find(
        activeStatusFilter,
        { name: 1, caValue: 1, budget: 1, completionPercent: 1 }
      ).sort({ caValue: -1, createdAt: -1 }).limit(ACTIVE_PROJECTS_LIMIT).lean(),
    ]);
    const activeIds = activeProjectDocs.map((p: any) => p._id);
    const [workDoneAgg, paymentAgg] = await Promise.all([
      Invoice.aggregate([
        { $match: { projectId: { $in: activeIds }, status: { $in: ["sent", "paid", "overdue"] }, deletedAt: null } },
        { $group: { _id: "$projectId", total: { $sum: "$subtotal" } } },
      ]),
      LedgerEntry.aggregate([
        { $match: { projectId: { $in: activeIds }, type: "income" } },
        { $group: { _id: "$projectId", total: { $sum: "$amount" } } },
      ]),
    ]);
    const workMap = Object.fromEntries((workDoneAgg as any[]).map((r) => [r._id.toString(), r.total]));
    const payMap = Object.fromEntries((paymentAgg as any[]).map((r) => [r._id.toString(), r.total]));
    const activeProjects = (activeProjectDocs as any[]).map((p: any) => {
      const key = p._id.toString();
      return {
        id: key,
        name: p.name,
        caValue: p.caValue > 0 ? p.caValue : (p.budget || 0),
        workDone: workMap[key] || 0,
        progress: Math.round(p.completionPercent || 0),
        paymentReceived: payMap[key] || 0,
      };
    });

    // ── 6-month revenue trend ───────────────────────────────────────────────
    const trendMap: Record<string, { income: number; expense: number }> = {};
    for (const r of trendAgg as any[]) {
      const key = `${r._id.year}-${r._id.month}`;
      if (!trendMap[key]) trendMap[key] = { income: 0, expense: 0 };
      trendMap[key][r._id.type as "income" | "expense"] = r.total;
    }
    const revenueTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      return { month: d.toLocaleString("default", { month: "short" }), income: trendMap[key]?.income || 0, expense: trendMap[key]?.expense || 0 };
    });

    return ok({
      projects, finances, staff, equipment, assets, activeProjects,
      activeProjectsTotalCount,
      revenueTrend, recentActivity, overdueTasks, overdueInvoices,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
