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

    const [totalIncomeAgg, totalExpenseAgg, monthIncomeAgg, monthExpenseAgg, bankAccounts, pendingInvoices] = await Promise.all([
      LedgerEntry.aggregate([{ $match: { type: "income" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      LedgerEntry.aggregate([{ $match: { type: "expense" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      LedgerEntry.aggregate([{ $match: { type: "income", date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      LedgerEntry.aggregate([{ $match: { type: "expense", date: { $gte: monthStart } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      BankAccount.find({ isActive: true }).sort({ balance: -1 }),
      Invoice.find({ status: { $in: ["draft","sent","overdue","partially_paid"] } })
        .populate("client", "name").sort({ dueDate: 1 }).limit(10),
    ]);

    const monthlyTrend = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const d = new Date(now.getFullYear(), i, 1);
        const next = new Date(now.getFullYear(), i + 1, 1);
        return Promise.all([
          LedgerEntry.aggregate([{ $match: { type: "income", date: { $gte: d, $lt: next } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
          LedgerEntry.aggregate([{ $match: { type: "expense", date: { $gte: d, $lt: next } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
        ]).then(([inc, exp]) => ({
          month: i + 1,
          label: d.toLocaleString("default", { month: "short" }),
          income: inc[0]?.total || 0,
          expense: exp[0]?.total || 0,
        }));
      })
    );

    return ok({
      totalIncome: totalIncomeAgg[0]?.total || 0,
      totalExpense: totalExpenseAgg[0]?.total || 0,
      monthIncome: monthIncomeAgg[0]?.total || 0,
      monthExpense: monthExpenseAgg[0]?.total || 0,
      bankAccounts,
      pendingInvoices,
      monthlyTrend,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
