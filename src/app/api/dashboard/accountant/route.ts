import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Invoice from "@/models/Invoice";

export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    await connectDB();

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

    const [totalsAgg, monthTotalsAgg, bankAccounts, pendingInvoices, monthlyAgg] = await Promise.all([
      // All-time totals — single aggregation
      LedgerEntry.aggregate([
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),
      // This-month totals — single aggregation
      LedgerEntry.aggregate([
        { $match: { date: { $gte: monthStart } } },
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),
      BankAccount.find({ isActive: true }, { name: 1, bankName: 1, balance: 1, accountType: 1 })
        .sort({ balance: -1 }).lean(),
      Invoice.find(
        { status: { $in: ["draft", "sent", "overdue"] } },
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
    ]);

    const totalIncome = totalsAgg.find((r: any) => r._id === "income")?.total || 0;
    const totalExpense = totalsAgg.find((r: any) => r._id === "expense")?.total || 0;
    const monthIncome = monthTotalsAgg.find((r: any) => r._id === "income")?.total || 0;
    const monthExpense = monthTotalsAgg.find((r: any) => r._id === "expense")?.total || 0;

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

    return ok({
      totalIncome, totalExpense, monthIncome, monthExpense,
      bankAccounts, pendingInvoices, monthlyTrend,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
