import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Vendor from "@/models/Vendor";
import Invoice from "@/models/Invoice";
import Subcontract from "@/models/Subcontract";
import mongoose from "mongoose";

// Payments are ledger entries recorded through this "quick payment" form —
// scope the list to those categories so this page doesn't show every
// ledger entry (salaries, material purchases, maintenance, etc.), which
// would double-count what the General Ledger page already shows.
const PAYMENT_CATEGORIES = ["client_payment", "vendor_payment", "invoice_payment"];

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const projectId = searchParams.get("projectId");
    const vendorId = searchParams.get("vendorId");
    const filter: any = { category: { $in: PAYMENT_CATEGORIES } };
    if (type) filter.type = type;
    if (projectId) filter.projectId = projectId;
    if (vendorId) filter.vendorId = vendorId;
    await connectDB();
    const entries = await LedgerEntry.find(filter)
      .populate("project", "id name")
      .populate("bankAccount", "id name")
      .populate("vendor", "id name")
      .populate("createdBy", "id name")
      .sort({ date: -1 })
      .limit(500);
    return ok(entries);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const data = await req.json();
    if (!data.type || !data.amount || !data.date) throw new Error("type, amount, and date are required");
    if (!["income", "expense"].includes(data.type)) throw new ApiError(400, "type must be 'income' or 'expense'");
    const amount = parseFloat(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "amount must be a positive number");
    const entryDate = new Date(data.date);
    if (isNaN(entryDate.getTime())) throw new ApiError(400, "Invalid date");
    // Server-side date sanity — the UI blocks future dates but this entry
    // point didn't, which is how a typo like year "20206" reached the ledger.
    const tomorrow = new Date(); tomorrow.setHours(23, 59, 59, 999);
    if (entryDate > tomorrow) throw new ApiError(400, "Date cannot be in the future");
    if (entryDate.getFullYear() < 2000) throw new ApiError(400, "Date is unrealistically old — check the year");
    await connectDB();


    // Double-submit guard: identical entry by the same user within the last
    // 15s is a repeated click on a slow connection, not a second payment —
    // each duplicate here also duplicates the bank-balance mutation.
    const recentDuplicate = await LedgerEntry.findOne({
      type: data.type,
      amount,
      category: data.category || (data.type === "income" ? "client_payment" : "vendor_payment"),
      createdById: session.user.id,
      createdAt: { $gte: new Date(Date.now() - 15_000) },
    });
    if (recentDuplicate) {
      throw new ApiError(409, "An identical entry was just recorded - duplicate submission ignored.");
    }
    const bankAccId = toId(data.bankAccountId);
    const entry = await withTransaction(async (dbSession) => {
      const [createdEntry] = await LedgerEntry.create(
        [{
          date: entryDate,
          type: data.type,
          amount,
          category: data.category || (data.type === "income" ? "client_payment" : "vendor_payment"),
          description: data.description || null,
          referenceNumber: data.referenceNumber || null,
          projectId: toId(data.projectId),
          bankAccountId: bankAccId,
          vendorId: toId(data.vendorId),
          partyName: data.partyName || null,
          partyType: data.partyType || "other",
          receiptPath: data.receiptPath || null,
          createdById: session.user.id,
        }],
        { session: dbSession }
      );
      if (bankAccId) {
        const delta = data.type === "income" ? amount : -amount;
        await BankAccount.findByIdAndUpdate(bankAccId, { $inc: { balance: delta } }, { session: dbSession });
      }
      return createdEntry;
    });
    void auditLog(session.user.id, "CREATE", "Payment", entry.id, `${data.type} payment PKR ${amount}`);
    return created(entry);
  } catch (e) {
    return handleApiError(e);
  }
}
