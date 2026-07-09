import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import mongoose from "mongoose";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    await connectDB();
    const entry = await LedgerEntry.findById(id)
      .populate("project", "name")
      .populate("bankAccount", "name")
      .populate("vendor", "name")
      .populate("createdBy", "name")
      .lean();
    if (!entry) throw new ApiError(404, "Payment record not found");
    return ok({ ...(entry as any), id: (entry as any)._id?.toString() });
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
    await connectDB();
    const entry = await LedgerEntry.findById(id);
    if (!entry) throw new ApiError(404, "Payment record not found");

    // Only allow updating non-financial metadata fields to prevent ledger corruption
    if (data.description !== undefined) entry.description = data.description;
    if (data.referenceNumber !== undefined) entry.referenceNumber = data.referenceNumber;
    if (data.partyName !== undefined) entry.partyName = data.partyName;
    if (data.date !== undefined) entry.date = new Date(data.date);

    await entry.save();
    await auditLog(session.user.id, "UPDATE", "Payment", id, `Updated metadata for payment ${entry.referenceNumber || id}`);
    return ok(entry);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    // Reversals are highly sensitive — limit to admin and ceo roles
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    await connectDB();
    const entry = await LedgerEntry.findById(id);
    if (!entry) throw new ApiError(404, "Payment record not found");

    if (entry.description?.startsWith("REVERSAL:") || entry.referenceNumber?.startsWith("REV-")) {
      throw new ApiError(400, "Cannot reverse a reversal entry.");
    }

    // Issue #95: Reversal mechanism. Instead of deletion, create a balancing transaction.
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    let reversalId = "";
    try {
      // 1. Reverse the bank account balance change
      if (entry.bankAccountId) {
        const bank = await BankAccount.findById(entry.bankAccountId).session(dbSession);
        if (bank) {
          // If original was income, we subtract it. If original was expense, we add it back.
          const delta = entry.type === "income" ? -entry.amount : entry.amount;
          
          if (entry.type === "income" && bank.balance + delta < 0) {
            // Reversing an income subtracts from the balance — guard against overdraft
            throw new Error(`Cannot reverse payment: bank balance would drop below zero.`);
          }
          bank.balance += delta;
          await bank.save({ session: dbSession });
        }
      }

      // 2. Create the offsetting ledger entry
      const reversal = await LedgerEntry.create([{
        date: new Date(),
        type: entry.type === "income" ? "expense" : "income",
        amount: entry.amount,
        category: entry.category,
        description: `REVERSAL: ${entry.description || "Original transaction reversed"}`,
        referenceNumber: `REV-${entry.referenceNumber || entry.id}`,
        projectId: entry.projectId || null,
        bankAccountId: entry.bankAccountId || null,
        vendorId: entry.vendorId || null,
        partyName: entry.partyName || null,
        partyType: entry.partyType || "other",
        createdById: session.user.id,
      }], { session: dbSession });

      reversalId = reversal[0].id;
      await dbSession.commitTransaction();
    } catch (txErr) {
      await dbSession.abortTransaction();
      throw txErr;
    } finally {
      await dbSession.endSession();
    }

    await auditLog(session.user.id, "DELETE", "Payment", id, `Reversed payment transaction. Reversal ID: ${reversalId}`);
    return ok({ success: true, message: "Transaction reversed successfully", reversalId });
  } catch (e) {
    return handleApiError(e);
  }
}
