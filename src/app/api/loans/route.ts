import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Loan, { LOAN_BORROWER_TYPES } from "@/models/Loan";
import LoanRepayment from "@/models/LoanRepayment";
import BankAccount from "@/models/BankAccount";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const filter: any = {};
    if (status) filter.status = status;
    await connectDB();
    const loans = await Loan.find(filter).populate("bankAccount", "id name").sort({ issueDate: -1 }).limit(500).lean({ virtuals: true });
    const ids = (loans as any[]).map((l: any) => l._id);
    const repaidAgg = await LoanRepayment.aggregate([
      { $match: { loanId: { $in: ids } } },
      { $group: { _id: "$loanId", total: { $sum: "$amount" } } },
    ]);
    const repaidMap = Object.fromEntries(repaidAgg.map((r: any) => [r._id.toString(), r.total]));
    const result = (loans as any[]).map((l: any) => {
      const id = l._id?.toString() || l.id;
      const repaid = repaidMap[id] || 0;
      return { ...l, id, repaidAmount: repaid, outstandingAmount: Math.max(0, l.principalAmount - repaid) };
    });
    return ok(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const data = await req.json();
    if (!data.borrowerType || !LOAN_BORROWER_TYPES.includes(data.borrowerType)) {
      throw new ApiError(400, `borrowerType must be one of: ${LOAN_BORROWER_TYPES.join(", ")}`);
    }
    if (!data.borrowerName?.trim()) throw new ApiError(400, "Borrower name is required");
    const principalAmount = parseFloat(data.principalAmount);
    if (!Number.isFinite(principalAmount) || principalAmount <= 0) throw new ApiError(400, "principalAmount must be a positive number");

    await connectDB();
    const bankAccountId = toId(data.bankAccountId);
    const issueDate = data.issueDate ? new Date(data.issueDate) : new Date();

    // Giving a loan converts cash into a receivable — it's not an expense,
    // so (like investments) this adjusts the bank balance directly rather
    // than going through LedgerEntry / P&L.
    const loan = await withTransaction(async (dbSession) => {
      const [createdLoan] = await Loan.create(
        [{
          borrowerType: data.borrowerType,
          borrowerId: toId(data.borrowerId),
          borrowerName: data.borrowerName,
          principalAmount,
          issueDate,
          expectedReturnDate: data.expectedReturnDate ? new Date(data.expectedReturnDate) : null,
          bankAccountId,
          status: "active",
          notes: data.notes || null,
          createdById: session.user.id,
        }],
        { session: dbSession }
      );
      if (bankAccountId) {
        const bankAccount = await BankAccount.findById(bankAccountId, null, { session: dbSession });
        if (!bankAccount) throw new ApiError(404, "Bank account not found");
        if (bankAccount.balance < principalAmount) {
          throw new ApiError(400, `Insufficient funds: bank account balance is PKR ${bankAccount.balance.toLocaleString()}, loan is PKR ${principalAmount.toLocaleString()}`);
        }
        await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: -principalAmount } }, { session: dbSession });
      }
      return createdLoan;
    });

    void auditLog(session.user.id, "CREATE", "Loan", loan.id, `Issued loan of PKR ${principalAmount} to ${data.borrowerName}`);
    return created(loan);
  } catch (e) {
    return handleApiError(e);
  }
}
