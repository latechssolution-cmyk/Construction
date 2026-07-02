import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import BankAccount from "@/models/BankAccount";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const account = await BankAccount.findById(id);
    if (!account) throw new ApiError(404, "Account not found");
    const ledgerEntries = await LedgerEntry.find({ bankAccountId: id }).sort({ date: -1 }).limit(50);
    return ok({ ...account.toJSON(), ledgerEntries });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const account = await BankAccount.findById(id);
    if (!account) throw new ApiError(404, "Account not found");
    if (data.name !== undefined) account.name = data.name;
    if (data.bankName !== undefined) account.bankName = data.bankName;
    if (data.accountNumber !== undefined) account.accountNumber = data.accountNumber;
    if (data.notes !== undefined) account.notes = data.notes;
    await account.save();
    await auditLog(session.user.id, "UPDATE", "BankAccount", id, `Updated: ${account.name}`);
    return ok(account);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    await connectDB();
    await BankAccount.findByIdAndUpdate(id, { isActive: false });
    await auditLog(session.user.id, "DELETE", "BankAccount", id, "Deactivated bank account");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
