import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const employee = await Employee.findById(id, { name: 1, salary: 1, salaryType: 1 });
    if (!employee) throw new ApiError(404, "Employee not found");
    const entries = await LedgerEntry.find({ category: "salary", employeeId: id }).sort({ date: -1 });
    return ok({ employee, salaryHistory: entries });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const employee = await Employee.findById(id, { name: 1, salary: 1 });
    if (!employee) throw new ApiError(404, "Employee not found");
    const amount = parseFloat(data.amount || String(employee.salary));
    const entry = await LedgerEntry.create({
      date: data.date ? new Date(data.date) : new Date(),
      type: "expense",
      amount,
      category: "salary",
      employeeId: id,
      description: `Salary payment - ${employee.name} [${id}] - ${data.month || ""}`,
      bankAccountId: data.bankAccountId || null,
      createdById: session.user.id,
      referenceNumber: data.referenceNumber || null,
      partyName: employee.name,
      partyType: "employee",
    });
    if (data.bankAccountId) {
      await BankAccount.findByIdAndUpdate(data.bankAccountId, { $inc: { balance: -amount } });
    }
    await auditLog(session.user.id, "CREATE", "Salary", entry.id, `Paid salary: ${employee.name} PKR ${amount}`);
    return created(entry);
  } catch (e) {
    return handleApiError(e);
  }
}
