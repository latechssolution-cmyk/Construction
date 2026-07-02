import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Invoice from "@/models/Invoice";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import mongoose from "mongoose";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const invoice = await Invoice.findById(id)
      .populate("client")
      .populate("project", "id name")
      .populate("createdBy", "name");
    if (!invoice) throw new ApiError(404, "Invoice not found");
    return ok(invoice);
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
    const existing = await Invoice.findById(id, { status: 1, grandTotal: 1, clientId: 1, invoiceNumber: 1, projectId: 1, retentionAmount: 1, whtDeducted: 1 });
    if (!existing) throw new ApiError(404, "Invoice not found");
    const TRANSITIONS: Record<string, string[]> = {
      draft: ["sent", "cancelled"],
      // Issue #61: partially_paid is now a reachable transition
      sent: ["paid", "partially_paid", "overdue", "cancelled", "draft"],
      overdue: ["paid", "partially_paid", "cancelled"],
      partially_paid: ["paid", "overdue", "cancelled"],
      paid: [],
      cancelled: [],
      issued: ["sent", "paid", "partially_paid", "overdue", "cancelled"],
    };
    if (data.status !== undefined && data.status !== existing.status) {
      const allowed = TRANSITIONS[existing.status] || [];
      if (!allowed.includes(data.status)) {
        throw new ApiError(400, `Cannot change invoice status from "${existing.status}" to "${data.status}"`);
      }
    }
    const update: any = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.paymentTerms !== undefined) update.paymentTerms = data.paymentTerms;
    const marksPaid = data.status === "paid" && existing.status !== "paid";
    if (marksPaid) update.paidAt = new Date();

    const bankAccountId = marksPaid ? toId(data.bankAccountId) : null;

    const invoice = await withTransaction(async (dbSession) => {
      const updated = await Invoice.findByIdAndUpdate(id, update, { new: true, session: dbSession });
      if (!updated) throw new ApiError(404, "Invoice not found");

      if (marksPaid) {
        await LedgerEntry.create(
          [{
            date: new Date(),
            type: "income",
            amount: existing.grandTotal,
            category: "invoice_payment",
            description: `Payment received for ${existing.invoiceNumber}`,
            bankAccountId,
            projectId: toId(existing.projectId),
            createdById: session.user.id,
            referenceNumber: existing.invoiceNumber,
            partyType: "client",
          }],
          { session: dbSession }
        );
        if (bankAccountId) {
          await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: existing.grandTotal } }, { session: dbSession });
        }
      }
      return updated;
    });

    await auditLog(session.user.id, "UPDATE", "Invoice", id, `Updated invoice ${invoice.invoiceNumber} → ${invoice.status}`);
    return ok(invoice);
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
    const existing = await Invoice.findById(id, { status: 1, invoiceNumber: 1 });
    if (!existing) throw new ApiError(404, "Invoice not found");
    if (existing.status === "paid") {
      throw new ApiError(400, "Cannot delete a paid invoice. This would erase recorded income — cancel future invoices instead of deleting paid ones.");
    }
    await withTransaction(async (dbSession) => {
      const relatedEntry = await LedgerEntry.findOneAndDelete(
        { referenceNumber: existing.invoiceNumber, category: "invoice_payment" },
        { session: dbSession }
      );
      if (relatedEntry?.bankAccountId) {
        await BankAccount.findByIdAndUpdate(relatedEntry.bankAccountId, { $inc: { balance: -relatedEntry.amount } }, { session: dbSession });
      }
      await Invoice.findByIdAndDelete(id, { session: dbSession });
    });
    await auditLog(session.user.id, "DELETE", "Invoice", id, "Deleted invoice");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
