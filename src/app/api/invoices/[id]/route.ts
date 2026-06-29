import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";

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
    const existing = await Invoice.findById(id, { status: 1, grandTotal: 1, clientId: 1, invoiceNumber: 1, projectId: 1 });
    if (!existing) throw new ApiError(404, "Invoice not found");
    const update: any = {};
    if (data.status !== undefined) update.status = data.status;
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.paymentTerms !== undefined) update.paymentTerms = data.paymentTerms;
    if (data.status === "paid" && existing.status !== "paid") update.paidAt = new Date();
    const invoice = await Invoice.findByIdAndUpdate(id, update, { new: true });
    if (data.status === "paid" && existing.status !== "paid") {
      let bankAccountId = toId(data.bankAccountId);
      if (!bankAccountId) {
        const defaultAccount = await BankAccount.findOne({ isActive: true });
        if (defaultAccount) bankAccountId = defaultAccount._id.toString();
      }
      await LedgerEntry.create({
        date: new Date(),
        type: "income",
        amount: existing.grandTotal,
        category: "invoice_payment",
        description: `Payment received for ${existing.invoiceNumber}`,
        bankAccountId: bankAccountId,
        projectId: toId(existing.projectId),
        createdById: session.user.id,
        referenceNumber: existing.invoiceNumber,
        partyType: "client",
      });
      if (bankAccountId) {
        await BankAccount.findByIdAndUpdate(bankAccountId, {
          $inc: { balance: existing.grandTotal },
        });
      }
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
    requireRole(session, "admin");
    const { id } = await params;
    await connectDB();
    await Invoice.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "Invoice", id, "Deleted invoice");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
