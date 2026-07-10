import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import mongoose from "mongoose";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    await connectDB();
    const entry = await LedgerEntry.findById(id)
      .populate("project", "id name")
      .populate("bankAccount", "id name")
      .populate("vendor", "id name")
      .populate("createdBy", "id name");
    if (!entry) throw new ApiError(404, "Ledger entry not found");
    return ok(entry);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const data = await req.json();
    if (data.amount !== undefined) {
      const parsedAmount = parseFloat(data.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > 100_000_000_000) {
        throw new ApiError(400, "amount must be a positive number no greater than 100,000,000,000");
      }
    }
    if (data.type !== undefined && !["income", "expense"].includes(data.type)) {
      throw new ApiError(400, "type must be 'income' or 'expense'");
    }
    await connectDB();

    const entry = await withTransaction(async (dbSession) => {
      const existing = await LedgerEntry.findById(id, null, { session: dbSession });
      if (!existing) throw new ApiError(404, "Ledger entry not found");

      const update: any = {};
      if (data.date !== undefined) update.date = new Date(data.date);
      if (data.type !== undefined) update.type = data.type;
      if (data.amount !== undefined) update.amount = parseFloat(data.amount);
      if (data.category !== undefined) update.category = data.category;
      if (data.description !== undefined) update.description = data.description;
      if (data.referenceNumber !== undefined) update.referenceNumber = data.referenceNumber;
      if (data.partyName !== undefined) update.partyName = data.partyName;
      if (data.partyType !== undefined) update.partyType = data.partyType;
      if (data.projectId !== undefined) update.projectId = toId(data.projectId);
      if (data.bankAccountId !== undefined) update.bankAccountId = toId(data.bankAccountId);
      if (data.vendorId !== undefined) update.vendorId = toId(data.vendorId);

      if (existing.bankAccountId) {
        const oldDelta = existing.type === "income" ? -existing.amount : existing.amount;
        await BankAccount.findByIdAndUpdate(existing.bankAccountId, { $inc: { balance: oldDelta } }, { session: dbSession });
      }

      const updated = await LedgerEntry.findByIdAndUpdate(id, update, { new: true, session: dbSession });
      if (!updated) throw new ApiError(404, "Ledger entry not found");

      if (updated.bankAccountId) {
        const newDelta = updated.type === "income" ? updated.amount : -updated.amount;
        await BankAccount.findByIdAndUpdate(updated.bankAccountId, { $inc: { balance: newDelta } }, { session: dbSession });
      }

      return updated;
    });

    void auditLog(session.user.id, "UPDATE", "LedgerEntry", id, "Updated ledger entry");
    return ok(entry);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin");
    const { id } = await params;
    await connectDB();
    await withTransaction(async (dbSession) => {
      const existing = await LedgerEntry.findById(id, null, { session: dbSession });
      if (!existing) throw new ApiError(404, "Ledger entry not found");
      if (existing.bankAccountId) {
        const delta = existing.type === "income" ? -existing.amount : existing.amount;
        await BankAccount.findByIdAndUpdate(existing.bankAccountId, { $inc: { balance: delta } }, { session: dbSession });
      }
      await LedgerEntry.findByIdAndDelete(id, { session: dbSession });
    });
    void auditLog(session.user.id, "DELETE", "LedgerEntry", id, "Deleted ledger entry");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
