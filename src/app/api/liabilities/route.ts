import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";

// Liabilities are invoices flagged with `isLiability: true` — money the
// company owes, kept separate from client receivables. Each row carries a
// derived `liabilityStatus` ("paid" | "unpaid") based on `liabilityPaidAt`.
export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    await connectDB();
    const liabilities = await Invoice.find({ isLiability: true, deletedAt: null })
      .populate("client", "id name")
      .populate("project", "id name")
      .populate("createdBy", "name")
      .sort({ liabilityPaidAt: 1, createdAt: -1 })
      .limit(500)
      .lean({ virtuals: true });
    return ok((liabilities as any[]).map((l: any) => ({
      ...l,
      id: l._id?.toString() || l.id,
      liabilityStatus: l.liabilityPaidAt ? "paid" : "unpaid",
    })));
  } catch (e) {
    return handleApiError(e);
  }
}
