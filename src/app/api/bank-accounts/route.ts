import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import BankAccount from "@/models/BankAccount";
import LedgerEntry from "@/models/LedgerEntry";

import mongoose from "mongoose";
const FINANCE_ROLES = ["admin", "ceo", "accountant"];

export async function GET() {
  try {
    const session = await requireAuth();
    const isFinance = FINANCE_ROLES.includes(session.user.role);
    await connectDB();
    const accounts = await BankAccount.find({ isActive: true }).sort({ name: 1 }).limit(100);
    const ids = accounts.map((a) => a._id);
    const counts = await LedgerEntry.aggregate([
      { $match: { bankAccountId: { $in: ids } } },
      { $group: { _id: "$bankAccountId", count: { $sum: 1 } } },
    ]);
    const cMap = Object.fromEntries(counts.map((r: any) => [r._id.toString(), r.count]));
    // Non-finance roles (e.g. managers picking a bank account on an expense
    // form) get the account names only — balance/account number are financial
    // data and shouldn't be readable by every authenticated user.
    const result = accounts.map((a) => {
      const json = a.toJSON() as any;
      if (!isFinance) {
        delete json.balance;
        delete json.accountNumber;
        delete json.notes;
      }
      return { ...json, _count: { ledgerEntries: cMap[a.id] || 0 } };
    });
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
    if (!data.name?.trim()) throw new Error("Account name is required");
    await connectDB();
    const initialBalance = parseFloat(data.balance || "0");
    if (isNaN(initialBalance) || initialBalance < 0) throw new ApiError(400, "Opening balance cannot be negative");
    const dbSession = await mongoose.startSession();
    let account: any;
    try {
      await dbSession.withTransaction(async () => {
        const [createdAccount] = await BankAccount.create([{
          name: data.name,
          bankName: data.bankName || null,
          accountNumber: data.accountNumber || null,
          accountType: data.accountType || "current",
          balance: initialBalance,
          currency: data.currency || "PKR",
          notes: data.notes || null,
        }], { session: dbSession });
        account = createdAccount;

        if (initialBalance > 0) {
          await LedgerEntry.create([{
            date: new Date(),
            type: "income",
            amount: initialBalance,
            category: "opening_balance",
            description: `Opening balance for bank account ${account.name}`,
            bankAccountId: account._id,
            createdById: session.user.id,
          }], { session: dbSession });
        }
      });
    } finally {
      await dbSession.endSession();
    }
    void auditLog(session.user.id, "CREATE", "BankAccount", account.id, `Created: ${account.name} with starting balance PKR ${initialBalance}`);
    return created(account);
  } catch (e) {
    return handleApiError(e);
  }
}
