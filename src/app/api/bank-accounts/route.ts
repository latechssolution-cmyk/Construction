import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import BankAccount from "@/models/BankAccount";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const accounts = await BankAccount.find({ isActive: true }).sort({ name: 1 });
    const ids = accounts.map((a) => a._id);
    const counts = await LedgerEntry.aggregate([
      { $match: { bankAccountId: { $in: ids } } },
      { $group: { _id: "$bankAccountId", count: { $sum: 1 } } },
    ]);
    const cMap = Object.fromEntries(counts.map((r: any) => [r._id.toString(), r.count]));
    const result = accounts.map((a) => ({ ...a.toJSON(), _count: { ledgerEntries: cMap[a.id] || 0 } }));
    return ok(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const data = await req.json();
    if (!data.name) throw new Error("Account name is required");
    await connectDB();
    const account = await BankAccount.create({
      name: data.name,
      bankName: data.bankName || null,
      accountNumber: data.accountNumber || null,
      accountType: data.accountType || "current",
      balance: parseFloat(data.balance || "0"),
      currency: data.currency || "PKR",
      notes: data.notes || null,
    });
    await auditLog(session.user.id, "CREATE", "BankAccount", account.id, `Created: ${account.name}`);
    return created(account);
  } catch (e) {
    return handleApiError(e);
  }
}
