import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, handleApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import LedgerEntry from "@/models/LedgerEntry";
import Attendance from "@/models/Attendance";
import Material from "@/models/Material";

function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v).replace(/"/g, '""').replace(/[\r\n]+/g, " ");
    return `"${s}"`;
  };
  const lines = [headers.map((h) => escape(h)).join(",")];
  rows.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(",")));
  return lines.join("\r\n");
}

function csvResponse(csv: string, filename: string) {
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

const today = () => new Date().toISOString().split("T")[0];

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const exportModule = new URL(req.url).searchParams.get("module") || "";
    await connectDB();

    if (exportModule === "invoices") {
      requireRole(session, "admin", "ceo", "accountant");
      const rows = await Invoice.find({}).populate("client", "name").populate("project", "name").sort({ createdAt: -1 });
      const csv = toCSV(rows.map((r) => ({
        "Invoice #": r.invoiceNumber,
        Client: (r as any).client?.name || "",
        Project: (r as any).project?.name || "",
        "Issue Date": r.issueDate ? new Date(r.issueDate).toLocaleDateString() : "",
        "Due Date": r.dueDate ? new Date(r.dueDate).toLocaleDateString() : "",
        Subtotal: r.subtotal,
        "Tax %": r.taxPercent,
        "Grand Total": r.grandTotal,
        Status: r.status,
        Notes: r.notes || "",
      })));
      return csvResponse(csv, `invoices-${today()}.csv`);
    }

    if (exportModule === "ledger") {
      requireRole(session, "admin", "ceo", "accountant");
      const rows = await LedgerEntry.find({}).populate("project", "name").populate("vendor", "name").sort({ date: -1 });
      const csv = toCSV(rows.map((r) => ({
        Date: new Date(r.date).toLocaleDateString(),
        Type: r.type,
        Category: r.category,
        Amount: r.amount,
        Project: (r as any).project?.name || "",
        Vendor: (r as any).vendor?.name || "",
        "Party Name": r.partyName || "",
        "Reference #": r.referenceNumber || "",
        Description: r.description || "",
      })));
      return csvResponse(csv, `ledger-${today()}.csv`);
    }

    if (exportModule === "attendance") {
      requireRole(session, "admin", "ceo", "manager");
      const rows = await Attendance.find({}).populate("employee", "name").sort({ date: -1 });
      const csv = toCSV(rows.map((r) => ({
        Date: new Date(r.date).toLocaleDateString(),
        Employee: (r as any).employee?.name || "",
        Status: r.status,
        "Hours Worked": r.hoursWorked || 0,
        Notes: r.notes || "",
      })));
      return csvResponse(csv, `attendance-${today()}.csv`);
    }

    if (exportModule === "materials") {
      requireRole(session, "admin", "ceo", "manager");
      const rows = await Material.find({}).populate("project", "name").populate("vendor", "name").sort({ createdAt: -1 });
      const csv = toCSV(rows.map((r) => ({
        Name: r.itemName,
        Category: r.category || "",
        Unit: r.unit,
        "Unit Price": r.unitPrice,
        "Stock Quantity": r.stockQuantity,
        "Min Stock Level": r.minStockLevel,
        "Total Value": r.stockQuantity * r.unitPrice,
        Project: (r as any).project?.name || "",
        Vendor: (r as any).vendor?.name || "",
      })));
      return csvResponse(csv, `materials-${today()}.csv`);
    }

    if (exportModule === "payments") {
      requireRole(session, "admin", "ceo", "accountant");
      const rows = await LedgerEntry.find({ category: { $in: ["client_payment", "vendor_payment", "invoice_payment"] } })
        .populate("project", "name").populate("vendor", "name").sort({ date: -1 });
      const csv = toCSV(rows.map((r) => ({
        Date: new Date(r.date).toLocaleDateString(),
        Type: r.type,
        Category: r.category,
        Amount: r.amount,
        "Party Name": r.partyName || (r as any).vendor?.name || "",
        Project: (r as any).project?.name || "",
        "Reference #": r.referenceNumber || "",
        Description: r.description || "",
      })));
      return csvResponse(csv, `payments-${today()}.csv`);
    }

    return new NextResponse(JSON.stringify({ error: "Unknown export module" }), { status: 400 });
  } catch (e) {
    return handleApiError(e);
  }
}
