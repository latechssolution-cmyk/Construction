import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new ApiError(404, "Invoice not found");
    // A paid invoice's total is already booked as ledger income — changing
    // line items afterward would desync the invoice from that recorded
    // income with no trace of the edit.
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      throw new ApiError(400, `Cannot modify line items on a ${invoice.status} invoice`);
    }
    if (!data.description?.trim()) throw new ApiError(400, "description is required");
    const qty = parseFloat(data.quantity || "1");
    const unitPrice = parseFloat(data.unitPrice || "0");
    if (qty <= 0) throw new ApiError(400, "quantity must be greater than 0");
    if (unitPrice < 0) throw new ApiError(400, "unitPrice cannot be negative");
    const total = qty * unitPrice;
    const newItem = { description: data.description.trim(), quantity: qty, unit: data.unit || null, unitPrice, total };
    invoice.items.push(newItem as any);
    const subtotal = invoice.items.reduce((s, i) => s + i.total, 0);
    const taxAmount = (subtotal * invoice.taxPercent) / 100;
    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.grandTotal = subtotal + taxAmount - (invoice.retentionAmount || 0) - (invoice.whtDeducted || 0);
    await invoice.save();
    const addedItem = invoice.items[invoice.items.length - 1];
    void auditLog(session.user.id, "UPDATE", "Invoice", id, `Added line item to ${invoice.invoiceNumber}: ${newItem.description}`);
    return created(addedItem);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get("itemId");
    if (!itemId) throw new ApiError(400, "itemId is required");
    await connectDB();
    const invoice = await Invoice.findById(id);
    if (!invoice) throw new ApiError(404, "Invoice not found");
    if (invoice.status === "paid" || invoice.status === "cancelled") {
      throw new ApiError(400, `Cannot modify line items on a ${invoice.status} invoice`);
    }
    invoice.items = invoice.items.filter((i) => i._id?.toString() !== itemId) as any;
    const subtotal = invoice.items.reduce((s, i) => s + i.total, 0);
    const taxAmount = (subtotal * invoice.taxPercent) / 100;
    invoice.subtotal = subtotal;
    invoice.taxAmount = taxAmount;
    invoice.grandTotal = subtotal + taxAmount - (invoice.retentionAmount || 0) - (invoice.whtDeducted || 0);
    await invoice.save();
    void auditLog(session.user.id, "UPDATE", "Invoice", id, `Removed line item from ${invoice.invoiceNumber}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
