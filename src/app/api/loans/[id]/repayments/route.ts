import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Loan from "@/models/Loan";
import LoanRepayment from "@/models/LoanRepayment";
import BankAccount from "@/models/BankAccount";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const data = await req.json();
    const amount = parseFloat(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "amount must be a positive number");

    await connectDB();
    const loan = await Loan.findById(id);
    if (!loan) throw new ApiError(404, "Loan not found");
    if (loan.status === "written_off") throw new ApiError(400, "This loan has been written off — cannot record further repayments.");

    const existingRepayments = await LoanRepayment.aggregate([
      { $match: { loanId: loan._id } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const alreadyRepaid = existingRepayments[0]?.total || 0;
    const outstanding = loan.principalAmount - alreadyRepaid;
    if (amount > outstanding) {
      throw new ApiError(400, `Repayment exceeds outstanding balance (PKR ${outstanding.toLocaleString()} remaining)`);
    }

    const bankAccountId = toId(data.bankAccountId);
    const date = data.date ? new Date(data.date) : new Date();

    const repayment = await withTransaction(async (dbSession) => {
      const [createdRepayment] = await LoanRepayment.create(
        [{ loanId: loan._id, amount, date, bankAccountId, notes: data.notes || null, createdById: session.user.id }],
        { session: dbSession }
      );
      if (bankAccountId) {
        await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: amount } }, { session: dbSession });
      }
      const newTotal = alreadyRepaid + amount;
      await Loan.findByIdAndUpdate(
        loan._id,
        { status: newTotal >= loan.principalAmount ? "repaid" : "partially_repaid" },
        { session: dbSession }
      );
      return createdRepayment;
    });

    void auditLog(session.user.id, "CREATE", "LoanRepayment", repayment.id, `Recorded repayment of PKR ${amount} for ${loan.borrowerName}`);
    return created(repayment);
  } catch (e) {
    return handleApiError(e);
  }
}
