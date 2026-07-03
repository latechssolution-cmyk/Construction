import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
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
    if (data.status === "paid" && existing.status !== "paid") update.paidAt = new Date();

    const dbSession = await mongoose.startSession();
    let invoice: any;
    try {
      await dbSession.withTransaction(async () => {
        invoice = await Invoice.findByIdAndUpdate(id, update, { new: true, session: dbSession });
        if (!invoice) throw new ApiError(404, "Invoice not found");

        if (data.status === "paid" && existing.status !== "paid") {
          const existingPayment = await LedgerEntry.findOne({ referenceNumber: existing.invoiceNumber, category: "invoice_payment" }).session(dbSession);
          if (!existingPayment) {
            let bankAccountId = toId(data.bankAccountId);
            if (!bankAccountId) {
              const defaultAccount = await BankAccount.findOne({ isActive: true }).session(dbSession);
              if (defaultAccount) bankAccountId = defaultAccount._id.toString();
            }
            const netAmount = existing.grandTotal;
            await LedgerEntry.create([{
              date: new Date(),
              type: "income",
              amount: netAmount,
              category: "invoice_payment",
              description: `Payment received for ${existing.invoiceNumber} (Net of Retention & WHT)`,
              bankAccountId: bankAccountId,
              projectId: toId(existing.projectId),
              createdById: session.user.id,
              referenceNumber: existing.invoiceNumber,
              partyType: "client",
            }], { session: dbSession });
            if (bankAccountId) {
              await BankAccount.findByIdAndUpdate(bankAccountId, {
                $inc: { balance: netAmount },
              }, { session: dbSession });
            }
          }
        }
      });
    } finally {
      await dbSession.endSession();
    }
    await auditLog(session.user.id, "UPDATE", "Invoice", id, `Updated invoice ${invoice!.invoiceNumber} → ${invoice!.status}`);
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
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new ApiError(404, "Invoice not found");
    // Issue #66: Soft-delete only — financial records must be retained 6+ years (FBR/SECP)
    // Paid invoices cannot be deleted even by admins
    if (invoice.status === "paid" || invoice.status === "partially_paid") {
      throw new ApiError(400, "Paid invoices cannot be deleted. Cancel it and issue a credit note if needed.");
    }
    (invoice as any).deletedAt = new Date();
    invoice.status = "cancelled";
    await invoice.save();
    await auditLog(session.user.id, "DELETE", "Invoice", id, `Soft-deleted invoice ${invoice.invoiceNumber}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
