import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { nextInvoiceNumber } from "@/lib/sequence";
import { withTransaction } from "@/lib/db-transaction";
import Invoice from "@/models/Invoice";
import Project from "@/models/Project";
import Contract from "@/models/Contract";
import Counter from "@/models/Counter";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const clientId = searchParams.get("clientId");
    const projectId = searchParams.get("projectId");
    // Issue #66: Exclude soft-deleted invoices from all list results
    const filter: any = { deletedAt: null };
    if (status) {
      if (status === "overdue") {
        filter.status = "sent";
        filter.dueDate = { $lt: new Date() };
      } else if (status === "sent") {
        filter.status = "sent";
        filter.$or = [{ dueDate: null }, { dueDate: { $gte: new Date() } }];
      } else {
        filter.status = status;
      }
    }
    if (clientId) filter.clientId = clientId;
    if (projectId) filter.projectId = projectId;
    await connectDB();
    // Issue #63: Overdue flagging moved to /api/cron — removed fire-and-forget here
    const invoices = await Invoice.find(filter)
      .populate("client", "id name")
      .populate("project", "id name")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean({ virtuals: true });
    return ok((invoices as any[]).map((inv: any) => {
      const isOverdue = inv.status === "sent" && inv.dueDate && new Date(inv.dueDate) < new Date();
      return {
        ...inv,
        id: inv._id?.toString() || inv.id,
        status: isOverdue ? "overdue" : inv.status,
      };
    }));
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
    if (!Array.isArray(data.items) || data.items.length === 0) throw new Error("At least one line item is required");
    await connectDB();

    // Issue #65: Validate each line item before processing
    const items = (data.items || []).map((item: any) => {
      if (!item.description?.trim()) throw new Error("Each item must have a description");
      const qty = parseFloat(String(item.quantity ?? "0"));
      const price = parseFloat(String(item.unitPrice ?? "0"));
      if (qty <= 0) throw new Error(`Item '${item.description}': quantity must be greater than 0`);
      if (price < 0) throw new Error(`Item '${item.description}': unit price cannot be negative`);
      return {
        description: item.description.trim(),
        quantity: qty,
        unit: item.unit || null,
        unitPrice: price,
        total: qty * price,
      };
    });

    const subtotal = items.reduce((s: number, i: any) => s + i.total, 0);
    const rawTax = parseFloat(data.taxPercent || "0");
    const taxPercent = isNaN(rawTax) ? 0 : Math.max(0, Math.min(100, rawTax));
    const taxAmount = (subtotal * taxPercent) / 100;

    const rawRetention = parseFloat(data.retentionPercent || "0");
    const retentionPercent = isNaN(rawRetention) ? 0 : Math.max(0, Math.min(100, rawRetention));
    const retentionAmount = (subtotal * retentionPercent) / 100;

    const whtDeducted = parseFloat(data.whtDeducted || "0") || 0;

    // Issue #60: CRITICAL FIX — grandTotal must deduct retention and WHT
    // Previously was: subtotal + taxAmount (inflating every invoice by retention + WHT amount)
    const grandTotal = subtotal + taxAmount - retentionAmount - whtDeducted;

    const projId = toId(data.projectId);
    const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();
    const dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (dueDate && dueDate < issueDate) throw new ApiError(400, "Due date cannot be before the issue date");
    const invoiceNumber = data.invoiceNumber || (await nextInvoiceNumber());

    // The contract-limit check and the invoice insert run inside the same
    // transaction so there's no gap between "read past invoice total" and
    // "write the new invoice" for a concurrent request to land in. This
    // narrows the race (two simultaneous invoices both squeaking under the
    // limit) rather than eliminating it outright — a fully atomic guarantee
    // would need a running total counter on Contract, which is a larger
    // schema change than this fix warrants for a soft business limit.
    const invoice = await withTransaction(async (dbSession) => {
      if (projId) {
        const project = await Project.findById(projId).session(dbSession ?? null);
        if (project && project.contractId) {
          const contract = await Contract.findById(project.contractId).session(dbSession ?? null).populate("variations");
          if (contract) {
            const pastInvoices = await Invoice.find({ projectId: projId, status: { $ne: "cancelled" }, deletedAt: null }).session(dbSession ?? null);
            const pastSum = pastInvoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
            const contractLimit = (contract as any).totalValue || contract.contractValue || 0;
            if (pastSum + grandTotal > contractLimit) {
              throw new ApiError(400, `Invoicing limit exceeded. Total invoiced including this invoice will be PKR ${(pastSum + grandTotal).toLocaleString()}, which exceeds the contract limit of PKR ${contractLimit.toLocaleString()}.`);
            }
          }
        }
      }

      const [createdInvoice] = await Invoice.create([{
        invoiceNumber,
        clientId: toId(data.clientId),
        projectId: projId,
        issueDate,
        dueDate,
        status: data.status || "draft",
        subtotal,
        taxPercent,
        taxAmount,
        retentionPercent,
        retentionAmount,
        whtDeducted,
        grandTotal,
        notes: data.notes || null,
        paymentTerms: data.paymentTerms || null,
        createdById: session.user.id,
        items,
      }], { session: dbSession });
      return createdInvoice;
    });
    await invoice.populate("client", "name");
    void auditLog(session.user.id, "CREATE", "Invoice", invoice.id, `Created invoice ${invoice.invoiceNumber}`);
    return created(invoice);
  } catch (e) {
    return handleApiError(e);
  }
}
