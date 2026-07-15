import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

// True liability totals across *all* liability records (not just the capped
// list) — mirrors /api/invoices/stats so the Liabilities summary cards stay
// accurate regardless of volume. `liabilityPaidAt` set ⇒ paid.
export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    await connectDB();
    const agg = await Invoice.aggregate([
      { $match: { isLiability: true, deletedAt: null } },
      {
        $group: {
          _id: { $cond: [{ $ifNull: ["$liabilityPaidAt", false] }, "paid", "unpaid"] },
          total: { $sum: "$grandTotal" },
          count: { $sum: 1 },
        },
      },
    ]);
    let totalPaid = 0, totalUnpaid = 0, paidCount = 0, unpaidCount = 0;
    for (const row of agg as any[]) {
      if (row._id === "paid") { totalPaid = row.total || 0; paidCount = row.count || 0; }
      else { totalUnpaid = row.total || 0; unpaidCount = row.count || 0; }
    }
    return ok({
      totalPaid,
      totalUnpaid,
      totalLiabilities: totalPaid + totalUnpaid,
      paidCount,
      unpaidCount,
      count: paidCount + unpaidCount,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
