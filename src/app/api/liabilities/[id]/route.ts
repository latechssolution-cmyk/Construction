import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Invoice from "@/models/Invoice";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";

const LIABILITY_CATEGORY = "liability_payment";

// Toggle a liability between paid and unpaid.
//   { paid: true, bankAccountId? }  → records an expense in the ledger
//     (and debits the chosen bank account) so cash/expense metrics stay
//     consistent with how invoice payments credit income.
//   { paid: false }                 → reverses that ledger entry and
//     restores the bank balance, so un-marking is fully dynamic too.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const data = await req.json();
    await connectDB();

    const existing = await Invoice.findById(id, {
      isLiability: 1, liabilityPaidAt: 1, grandTotal: 1, invoiceNumber: 1, projectId: 1,
    });
    if (!existing) throw new ApiError(404, "Liability not found");
    if (!existing.isLiability) throw new ApiError(400, "This record is not a liability");

    const markPaid = data.paid === true || data.paid === "true";
    const alreadyPaid = !!existing.liabilityPaidAt;
    if (markPaid === alreadyPaid) {
      // No-op transition — return current state without touching the ledger.
      return ok(existing);
    }

    const bankAccountId = markPaid ? toId(data.bankAccountId) : null;

    const updated = await withTransaction(async (dbSession) => {
      if (markPaid) {
        const inv = await Invoice.findByIdAndUpdate(id, { liabilityPaidAt: new Date() }, { new: true, session: dbSession });
        await LedgerEntry.create(
          [{
            date: new Date(),
            type: "expense",
            amount: existing.grandTotal,
            category: LIABILITY_CATEGORY,
            description: `Liability paid: ${existing.invoiceNumber}`,
            bankAccountId,
            projectId: toId(existing.projectId),
            createdById: session.user.id,
            referenceNumber: existing.invoiceNumber,
            partyType: "other",
          }],
          { session: dbSession }
        );
        if (bankAccountId) {
          await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: -existing.grandTotal } }, { session: dbSession });
        }
        return inv;
      } else {
        const inv = await Invoice.findByIdAndUpdate(id, { liabilityPaidAt: null }, { new: true, session: dbSession });
        const entry = await LedgerEntry.findOneAndDelete(
          { referenceNumber: existing.invoiceNumber, category: LIABILITY_CATEGORY },
          { session: dbSession }
        );
        if (entry?.bankAccountId) {
          await BankAccount.findByIdAndUpdate(entry.bankAccountId, { $inc: { balance: entry.amount } }, { session: dbSession });
        }
        return inv;
      }
    });

    void auditLog(session.user.id, "UPDATE", "Invoice", id, `Liability ${existing.invoiceNumber} marked ${markPaid ? "paid" : "unpaid"}`);
    return ok(updated);
  } catch (e) {
    return handleApiError(e);
  }
}
