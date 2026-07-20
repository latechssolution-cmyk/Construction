import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Loan, { LOAN_STATUSES, LOAN_BORROWER_TYPES } from "@/models/Loan";
import LoanRepayment from "@/models/LoanRepayment";
import BankAccount from "@/models/BankAccount";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    await connectDB();
    const loan = await Loan.findById(id).populate("bankAccount", "id name");
    if (!loan) throw new ApiError(404, "Loan not found");
    const repayments = await LoanRepayment.find({ loanId: id }).populate("bankAccount", "id name").sort({ date: -1 });
    const repaidAmount = repayments.reduce((s, r) => s + (r.amount || 0), 0);
    return ok({ ...loan.toJSON(), repayments, repaidAmount, outstandingAmount: Math.max(0, loan.principalAmount - repaidAmount) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const loan = await Loan.findById(id);
    if (!loan) throw new ApiError(404, "Loan not found");

    if (data.status !== undefined) {
      if (!LOAN_STATUSES.includes(data.status)) throw new ApiError(400, `status must be one of: ${LOAN_STATUSES.join(", ")}`);
      // Writing off a loan is a real loss to the company — admin/ceo only,
      // same bar as terminating a contract.
      if (data.status === "written_off") requireRole(session, "admin", "ceo");
      loan.status = data.status;
    }
    if (data.borrowerName !== undefined) {
      if (!String(data.borrowerName).trim()) throw new ApiError(400, "Borrower name cannot be empty");
      loan.borrowerName = String(data.borrowerName).trim();
    }
    if (data.borrowerType !== undefined) {
      if (!LOAN_BORROWER_TYPES.includes(data.borrowerType)) throw new ApiError(400, `borrowerType must be one of: ${LOAN_BORROWER_TYPES.join(", ")}`);
      loan.borrowerType = data.borrowerType;
    }
    if (data.expectedReturnDate !== undefined) loan.expectedReturnDate = data.expectedReturnDate ? new Date(data.expectedReturnDate) : null;
    if (data.notes !== undefined) loan.notes = data.notes;
    await loan.save();
    void auditLog(session.user.id, "UPDATE", "Loan", id, `Updated loan for ${loan.borrowerName}`);
    return ok(loan);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    // Deleting a loan un-does real money movements — admin/ceo only.
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    await connectDB();
    const loan = await Loan.findById(id);
    if (!loan) throw new ApiError(404, "Loan not found");

    await withTransaction(async (dbSession) => {
      // Reverse the issue: giving the loan debited the bank, so credit it back.
      if (loan.bankAccountId) {
        await BankAccount.findByIdAndUpdate(loan.bankAccountId, { $inc: { balance: loan.principalAmount } }, { session: dbSession });
      }
      // Reverse each repayment: repayments credited their bank account, so
      // debit those back before removing the records.
      const repayments = await LoanRepayment.find({ loanId: id }).session(dbSession ?? null);
      for (const r of repayments) {
        if (r.bankAccountId) {
          await BankAccount.findByIdAndUpdate(r.bankAccountId, { $inc: { balance: -r.amount } }, { session: dbSession });
        }
      }
      await LoanRepayment.deleteMany({ loanId: id }, { session: dbSession });
      await Loan.findByIdAndDelete(id, { session: dbSession });
    });

    void auditLog(session.user.id, "DELETE", "Loan", id, `Deleted loan of PKR ${loan.principalAmount.toLocaleString()} to ${loan.borrowerName} (bank balances restored)`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
