import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import BankAccount from "@/models/BankAccount";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));

    await connectDB();
    const account = await BankAccount.findById(id);
    if (!account) throw new ApiError(404, "Bank account not found");
    const filter: any = { bankAccountId: id };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }

    // Compute initial balance prior to the start of the date filter
    let initialBalance = 0;
    if (filter.date?.$gte) {
      const preAgg = await LedgerEntry.aggregate([
        { $match: { bankAccountId: account._id, date: { $lt: filter.date.$gte } } },
        {
          $group: {
            _id: null,
            balance: {
              $sum: {
                $cond: [
                  { $eq: ["$type", "income"] },
                  "$amount",
                  { $subtract: [0, "$amount"] }
                ]
              }
            }
          }
        }
      ]);
      initialBalance = preAgg[0]?.balance || 0;
    }

    const entries = await LedgerEntry.find(filter)
      .populate("project", "name")
      .populate("vendor", "name")
      .populate("createdBy", "name")
      .sort({ date: 1, createdAt: 1 })
      .lean();

    let currentRunning = initialBalance;
    const entriesWithBalance = entries.map((e: any) => {
      const delta = e.type === "income" ? e.amount : -e.amount;
      currentRunning += delta;
      return { ...e, id: e._id?.toString(), runningBalance: currentRunning };
    });

    const totalIncome = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const totalExpense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);

    const total = entriesWithBalance.length;
    const paginatedEntries = entriesWithBalance.slice((page - 1) * limit, page * limit);

    return ok({
      account,
      entries: paginatedEntries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
      summary: {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        initialBalance,
        currentBalance: account.balance,
        transactions: total,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
