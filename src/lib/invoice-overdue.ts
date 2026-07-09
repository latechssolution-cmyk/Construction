import { connectDB } from "./mongoose";
import Invoice from "@/models/Invoice";

// Persists the "overdue" status that was previously only computed at
// request-time in GET /api/invoices (display-only, never saved). Without
// this, /api/invoices/stats and any other query filtering on the stored
// `status` field silently disagreed with what the invoice list showed.
export async function sweepOverdueInvoices(now: Date = new Date()) {
  await connectDB();
  const result = await Invoice.updateMany(
    { status: "sent", dueDate: { $lt: now }, deletedAt: null },
    { $set: { status: "overdue" } }
  );
  return result.modifiedCount ?? 0;
}
