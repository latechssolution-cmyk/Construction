import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Investment from "@/models/Investment";
import BankAccount from "@/models/BankAccount";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    await connectDB();
    const investment = await Investment.findById(id);
    if (!investment) throw new ApiError(404, "Investment not found");

    await withTransaction(async (dbSession) => {
      if (investment.bankAccountId) {
        await BankAccount.findByIdAndUpdate(
          investment.bankAccountId,
          { $inc: { balance: -investment.amount } },
          { session: dbSession }
        );
      }
      await Investment.findByIdAndDelete(id, { session: dbSession });
    });

    void auditLog(session.user.id, "DELETE", "Investment", id, `Reversed investment of PKR ${investment.amount}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
