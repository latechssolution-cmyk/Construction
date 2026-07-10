import { NextRequest, NextResponse } from "next/server";
import { requireAuth, requireRole, handleApiError, ApiError } from "@/lib/api-helpers";
import { generateInvoicePDF } from "@/lib/pdf-generator";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    await connectDB();
    const invoice = await Invoice.findById(id, { invoiceNumber: 1 });
    if (!invoice) throw new ApiError(404, "Invoice not found");
    const buffer = await generateInvoicePDF(id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
