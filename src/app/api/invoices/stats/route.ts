import { requireAuth, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

// Aggregate totals across *all* invoices, not just the most recent 200 the
// list endpoint returns — the billing page's summary cards need true totals,
// which silently drifted from reality once invoice volume passed the cap.
export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const agg = await Invoice.aggregate([
      { $match: { deletedAt: null } },
      { $group: { _id: "$status", total: { $sum: "$grandTotal" }, count: { $sum: 1 } } },
    ]);
    const byStatus: Record<string, { total: number; count: number }> = {};
    let grandTotal = 0;
    for (const row of agg as any[]) {
      byStatus[row._id] = { total: row.total, count: row.count };
      grandTotal += row.total;
    }
    const totalPaid = byStatus.paid?.total || 0;
    const totalPending = (byStatus.sent?.total || 0) + (byStatus.overdue?.total || 0);
    return ok({ totalPaid, totalPending, totalInvoiced: grandTotal, byStatus });
  } catch (e) {
    return handleApiError(e);
  }
}
