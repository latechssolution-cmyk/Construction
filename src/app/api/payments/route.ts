import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const projectId = searchParams.get("projectId");
    const vendorId = searchParams.get("vendorId");
    const filter: any = {};
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
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) throw new Error("amount must be a positive number");
    await connectDB();
    const entry = await LedgerEntry.create({
      date: new Date(data.date),
      type: data.type,
      amount,
      category: data.category || (data.type === "income" ? "client_payment" : "vendor_payment"),
      description: data.description || null,
      referenceNumber: data.referenceNumber || null,
      projectId: toId(data.projectId),
      bankAccountId: toId(data.bankAccountId),
      vendorId: toId(data.vendorId),
      partyName: data.partyName || null,
      partyType: data.partyType || "other",
      receiptPath: data.receiptPath || null,
      createdById: session.user.id,
    });
    const bankAccId = toId(data.bankAccountId);
    if (bankAccId) {
      const delta = data.type === "income" ? amount : -amount;
      await BankAccount.findByIdAndUpdate(bankAccId, { $inc: { balance: delta } });
    }
    await auditLog(session.user.id, "CREATE", "Payment", entry.id, `${data.type} payment PKR ${amount}`);
    return created(entry);
  } catch (e) {
    return handleApiError(e);
  }
}
