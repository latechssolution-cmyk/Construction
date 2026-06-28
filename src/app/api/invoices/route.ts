import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

function generateInvoiceNumber() {
  const now = new Date();
  return `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");
    const projectId = searchParams.get("projectId");
    const filter: any = {};
    if (status) filter.status = status;
    if (clientId) filter.clientId = clientId;
    if (projectId) filter.projectId = projectId;
    await connectDB();
    // Mark overdue without blocking the read response (fire-and-forget)
    void Invoice.updateMany(
      { status: "sent", dueDate: { $lt: new Date() } },
      { $set: { status: "overdue" } }
    );
    const invoices = await Invoice.find(filter)
      .populate("client", "id name")
      .populate("project", "id name")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean({ virtuals: true });
    return ok(invoices);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const data = await req.json();
    if (!data.clientId) throw new Error("Client is required");
    await connectDB();
    const items = (data.items || []).map((item: any) => ({
      description: item.description,
      quantity: parseFloat(item.quantity || "1"),
      unit: item.unit || null,
      unitPrice: parseFloat(item.unitPrice || "0"),
      total: parseFloat(item.quantity || "1") * parseFloat(item.unitPrice || "0"),
    }));
    const subtotal = items.reduce((s: number, i: any) => s + i.total, 0);
    const taxPercent = parseFloat(data.taxPercent || "0");
    const taxAmount = (subtotal * taxPercent) / 100;
    const grandTotal = subtotal + taxAmount;
    const invoice = await Invoice.create({
      invoiceNumber: data.invoiceNumber || generateInvoiceNumber(),
      clientId: data.clientId,
      projectId: data.projectId || null,
      issueDate: data.issueDate ? new Date(data.issueDate) : new Date(),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: data.status || "draft",
      subtotal,
      taxPercent,
      taxAmount,
      grandTotal,
      notes: data.notes || null,
      paymentTerms: data.paymentTerms || null,
      createdById: session.user.id,
      items,
    });
    await invoice.populate("client", "name");
    await auditLog(session.user.id, "CREATE", "Invoice", invoice.id, `Created invoice ${invoice.invoiceNumber}`);
    return created(invoice);
  } catch (e) {
    return handleApiError(e);
  }
}
