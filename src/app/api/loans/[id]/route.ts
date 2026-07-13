import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Loan, { LOAN_STATUSES } from "@/models/Loan";
import LoanRepayment from "@/models/LoanRepayment";

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
    if (data.expectedReturnDate !== undefined) loan.expectedReturnDate = data.expectedReturnDate ? new Date(data.expectedReturnDate) : null;
    if (data.notes !== undefined) loan.notes = data.notes;
    await loan.save();
    void auditLog(session.user.id, "UPDATE", "Loan", id, `Updated loan for ${loan.borrowerName}`);
    return ok(loan);
  } catch (e) {
    return handleApiError(e);
  }
}
