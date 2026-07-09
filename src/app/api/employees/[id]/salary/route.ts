import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Employee from "@/models/Employee";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Attendance from "@/models/Attendance";

/**
 * Issue #69: Calculates statutory payroll deductions per Pakistani law.
 * - EOBI Employee: 1% of gross wage (capped at PKR 1,670 based on 2024 ceiling)
 * - EOBI Employer: 5% of gross wage (additional company cost, not deducted from salary)
 * - Income Tax: FBR simplified slab (annualized monthly income)
 */
function calculatePayrollDeductions(grossMonthly: number) {
  const eobiEmployee = Math.min(Math.round(grossMonthly * 0.01), 1670);
  const eobiEmployer = Math.min(Math.round(grossMonthly * 0.05), 8350);

  // FBR income tax slab (Tax Year 2024-25 — annualized)
  const annualIncome = grossMonthly * 12;
  let annualTax = 0;
  if (annualIncome <= 600000) annualTax = 0;
  else if (annualIncome <= 1200000) annualTax = (annualIncome - 600000) * 0.025;
  else if (annualIncome <= 2400000) annualTax = 15000 + (annualIncome - 1200000) * 0.125;
  else if (annualIncome <= 3600000) annualTax = 165000 + (annualIncome - 2400000) * 0.20;
  else if (annualIncome <= 6000000) annualTax = 405000 + (annualIncome - 3600000) * 0.25;
  else annualTax = 1005000 + (annualIncome - 6000000) * 0.325;

  const incomeTaxMonthly = Math.round(annualTax / 12);
  const totalDeductions = eobiEmployee + incomeTaxMonthly;
  const netPay = Math.max(0, grossMonthly - totalDeductions);

  return { eobiEmployee, eobiEmployer, incomeTaxMonthly, totalDeductions, netPay };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const monthParam = searchParams.get("month"); // e.g. "2026-07"
    
    await connectDB();
    const employee = await Employee.findById(id, { name: 1, salary: 1, salaryType: 1 });
    if (!employee) throw new ApiError(404, "Employee not found");
    const entries = await LedgerEntry.find({ category: "salary", employeeId: id }).sort({ date: -1 });

    let calculatedSalary = employee.salary || 0;
    let attendanceSummary = null;

    if (employee.salaryType === "daily" || employee.salaryType === "hourly") {
      let startDate = new Date();
      if (monthParam) {
        const [y, m] = monthParam.split("-").map(Number);
        startDate = new Date(y, m - 1, 1);
      } else {
        startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      }
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);

      const logs = await Attendance.find({ employeeId: id, date: { $gte: startDate, $lte: endDate } });
      if (employee.salaryType === "daily") {
        const present = logs.filter(l => l.status === "present").length;
        const halfDay = logs.filter(l => l.status === "half_day").length;
        calculatedSalary = (present + 0.5 * halfDay) * (employee.salary || 0);
        attendanceSummary = { present, halfDay, absent: logs.filter(l => l.status === "absent").length };
      } else {
        const totalHours = logs.reduce((sum, l) => sum + (l.hoursWorked || 0), 0);
        calculatedSalary = totalHours * (employee.salary || 0);
        attendanceSummary = { totalHours };
      }
    }

    // Include deduction preview in GET response
    const deductions = calculatePayrollDeductions(calculatedSalary);
    return ok({ employee, calculatedSalary, deductions, attendanceSummary, salaryHistory: entries });
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
    const amount = parseFloat(data.amount || "");
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new ApiError(400, "amount must be a positive number");
    }
    const bankAccountId = toId(data.bankAccountId);
    if (!bankAccountId) {
      throw new ApiError(400, "A bank account is required to pay salary");
    }
    const forMonth = typeof data.month === "string" && /^\d{4}-\d{2}$/.test(data.month) ? data.month : null;
    await connectDB();
    const employee = await Employee.findById(id, { name: 1, salary: 1, salaryType: 1, isActive: 1 });
    if (!employee) throw new ApiError(404, "Employee not found");

    if (forMonth) {
      const duplicate = await LedgerEntry.findOne({
        category: "salary",
        employeeId: id,
        description: { $regex: `\\[FOR:${forMonth}\\]$` },
      });
      if (duplicate) {
        throw new ApiError(409, `Salary for ${employee.name} has already been recorded for ${forMonth}.`);
      }
    }

    const entry = await withTransaction(async (dbSession) => {
      const [createdEntry] = await LedgerEntry.create(
        [{
          date: data.date ? new Date(data.date) : new Date(),
          type: "expense",
          amount,
          category: "salary",
          employeeId: id,
          description: `Salary payment - ${employee.name} [${id}] - ${data.month || ""}${forMonth ? ` [FOR:${forMonth}]` : ""}`,
          bankAccountId,
          createdById: session.user.id,
          referenceNumber: data.referenceNumber || null,
          partyName: employee.name,
          partyType: "employee",
        }],
        { session: dbSession }
      );
      const bankAcc = await BankAccount.findById(bankAccountId, null, { session: dbSession });
      if (!bankAcc) throw new ApiError(404, "Bank account not found");
      if (bankAcc.balance < amount) throw new ApiError(400, `Insufficient bank balance. Available: PKR ${bankAcc.balance.toLocaleString()}`);
      await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: -amount } }, { session: dbSession });
      return createdEntry;
    });

    void auditLog(session.user.id, "CREATE", "Salary", entry.id, `Paid salary: ${employee.name} PKR ${amount}`);
    return created(entry);
  } catch (e) {
    return handleApiError(e);
  }
}
