import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Invoice from "@/models/Invoice";
import Subcontract from "@/models/Subcontract";
import Asset from "@/models/Asset";
import Loan from "@/models/Loan";
import LoanRepayment from "@/models/LoanRepayment";

export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    await connectDB();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

    const [
      totalsAgg, monthTotalsAgg, bankAccounts, pendingInvoices, monthlyAgg,
      arAgg, openSubcontractsRaw, assetsRaw, loanAgg, loanRepaidAgg,
    ] = await Promise.all([
      // All-time totals — expense excludes inventory_asset (a balance-sheet
      // move, not a real P&L cost) to match the definition used everywhere
      // else (admin dashboard, profit sheets) — this used to include it,
      // making "Total Expense" disagree with the admin dashboard's figure
      // for the exact same underlying data.
      LedgerEntry.aggregate([
        { $group: { _id: null, income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } }, expense: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "expense"] }, { $ne: ["$category", "inventory_asset"] }] }, "$amount", 0] } } } },
      ]),
      LedgerEntry.aggregate([
        { $match: { date: { $gte: monthStart } } },
        { $group: { _id: null, income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } }, expense: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "expense"] }, { $ne: ["$category", "inventory_asset"] }] }, "$amount", 0] } } } },
      ]),
      BankAccount.find({ isActive: true }, { name: 1, bankName: 1, balance: 1, accountType: 1 })
        .sort({ balance: -1 }).lean(),
      Invoice.find(
        { status: { $in: ["draft", "sent", "overdue"] }, deletedAt: null },
        { invoiceNumber: 1, dueDate: 1, grandTotal: 1, status: 1, clientId: 1 }
      ).populate("client", "name").sort({ dueDate: 1 }).limit(10).lean({ virtuals: true }),
      // Full-year monthly trend — single aggregation replaces 24 separate queries
      LedgerEntry.aggregate([
        { $match: { date: { $gte: yearStart, $lt: yearEnd } } },
        {
          $group: {
            _id: { month: { $month: "$date" }, type: "$type" },
            total: { $sum: "$amount" },
          },
        },
      ]),
      // Accounts receivable = billed but unpaid (sent + overdue)
      Invoice.aggregate([
        { $match: { status: { $in: ["sent", "overdue"] }, deletedAt: null } },
        { $group: { _id: null, total: { $sum: { $subtract: ["$grandTotal", { $ifNull: ["$paidAmount", 0] }] } } } },
      ]),
      Subcontract.find({ status: "in_progress" }, { contractValue: 1, projectId: 1, vendorId: 1 }).lean(),
      Asset.find({}, { purchaseCost: 1, salvageValue: 1, usefulLifeYears: 1, purchaseDate: 1 }).lean(),
      Loan.aggregate([
        { $match: { status: { $ne: "written_off" } } },
        { $group: { _id: null, total: { $sum: "$principalAmount" } } },
      ]),
      LoanRepayment.aggregate([
        { $lookup: { from: "loans", localField: "loanId", foreignField: "_id", as: "loan" } },
        { $unwind: "$loan" },
        { $match: { "loan.status": { $ne: "written_off" } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
    ]);

    const totalRow = (totalsAgg as any[])[0] || {};
    const monthRow = (monthTotalsAgg as any[])[0] || {};
    const totalIncome = totalRow.income || 0;
    const totalExpense = totalRow.expense || 0;
    const monthIncome = monthRow.income || 0;
    const monthExpense = monthRow.expense || 0;

    const accountsReceivable = Math.max(0, (arAgg as any[])[0]?.total || 0);

    // Accounts payable = open subcontract commitments, netted against
    // payments already made against those *specific* (project, vendor)
    // pairs — same scoping fix as the admin dashboard, so both roles show
    // the identical, correct AP figure rather than two different numbers.
    const openSubcontracts = (openSubcontractsRaw as any[]).reduce((sum, s) => sum + (s.contractValue || 0), 0);
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

    let assetBookValue = 0;
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
      assetBookValue += book;
    }

    // Reconstruct monthly trend from single aggregation result
    const trendMap: Record<number, { income: number; expense: number }> = {};
    for (const r of monthlyAgg as any[]) {
      const m = r._id.month as number;
      if (!trendMap[m]) trendMap[m] = { income: 0, expense: 0 };
      trendMap[m][r._id.type as "income" | "expense"] = r.total;
    }
    const monthlyTrend = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const d = new Date(now.getFullYear(), i, 1);
      return {
        month,
        label: d.toLocaleString("default", { month: "short" }),
        income: trendMap[month]?.income || 0,
        expense: trendMap[month]?.expense || 0,
      };
    });

    // .lean() skips the schema's toJSON transform, so these come back with
    // `_id` not `id` — the frontend keys its lists by `.id`, which was
    // silently undefined for every bank account and pending invoice row.
    const withId = (rows: any[]) => rows.map((r) => ({ ...r, id: r._id.toString() }));

    const outstandingLoans = Math.max(0, ((loanAgg as any[])[0]?.total || 0) - ((loanRepaidAgg as any[])[0]?.total || 0));

    return ok({
      totalIncome, totalExpense, monthIncome, monthExpense,
      accountsReceivable, accountsPayable, assetBookValue, outstandingLoans,
      bankAccounts: withId(bankAccounts), pendingInvoices: withId(pendingInvoices), monthlyTrend,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
