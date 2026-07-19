import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { searchParams } = new URL(req.url);
    const rawYear = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
    const year = isNaN(rawYear) ? new Date().getFullYear() : Math.max(1990, Math.min(2100, rawYear));
    await connectDB();

    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year + 1, 0, 1);
    const baseMatch = { date: { $gte: yearStart, $lt: yearEnd } };
    const plMatch = {
      date: { $gte: yearStart, $lt: yearEnd },
      // inventory_asset entries are balance-sheet moves (stock offsets), not
      // P&L activity — excluded from BOTH sides, matching the totals above.
      category: { $ne: "inventory_asset" },
    };

    const [totalIncomeAgg, totalExpenseAgg, byCategoryAgg, monthlyAgg] = await Promise.all([
      LedgerEntry.aggregate([{ $match: { ...baseMatch, type: "income", category: { $ne: "inventory_asset" } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      LedgerEntry.aggregate([{ $match: { ...baseMatch, type: "expense", category: { $ne: "inventory_asset" } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      LedgerEntry.aggregate([
        { $match: plMatch },
        { $group: { _id: { category: "$category", type: "$type" }, total: { $sum: "$amount" } } },
        { $sort: { total: -1 } },
      ]),
      LedgerEntry.aggregate([
        { $match: plMatch },
        {
          $group: {
            _id: { $month: "$date" },
            income: { $sum: { $cond: [{ $eq: ["$type", "income"] }, "$amount", 0] } },
            expense: { $sum: { $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const inc = totalIncomeAgg[0]?.total || 0;
    const exp = totalExpenseAgg[0]?.total || 0;
    const byCategory = byCategoryAgg.map((r: any) => ({
      category: r._id.category,
      type: r._id.type,
      _sum: { amount: r.total },
    }));
    const monthly = monthlyAgg.map((r: any) => ({
      month: r._id,
      label: new Date(year, Number(r._id) - 1).toLocaleString("default", { month: "short" }),
      income: r.income,
      expense: r.expense,
    }));

    return ok({ totals: { totalIncome: inc, totalExpense: exp, net: inc - exp }, byCategory, monthly });
  } catch (e) {
    return handleApiError(e);
  }
}
