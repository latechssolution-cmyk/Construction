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
    await connectDB();
    const account = await BankAccount.findById(id);
    if (!account) throw new ApiError(404, "Bank account not found");
    const filter: any = { bankAccountId: id };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const entries = await LedgerEntry.find(filter)
      .populate("project", "name")
      .populate("vendor", "name")
      .populate("createdBy", "name")
      .sort({ date: 1 });
    const totalIncome = entries.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const totalExpense = entries.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return ok({
      account,
      entries,
      summary: {
        totalIncome,
        totalExpense,
        net: totalIncome - totalExpense,
        currentBalance: account.balance,
        transactions: entries.length,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
