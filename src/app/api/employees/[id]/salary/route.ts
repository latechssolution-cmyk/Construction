import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import mongoose from "mongoose";
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
    await requireAuth();
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
    await connectDB();
    const employee = await Employee.findById(id, { name: 1, salary: 1, salaryType: 1, isActive: 1 });
    if (!employee) throw new ApiError(404, "Employee not found");

    // Issue #71: Block salary payment for deactivated/terminated employees
    if (!employee.isActive) {
      throw new ApiError(400, `Cannot pay salary to a deactivated/terminated employee: ${employee.name}`);
    }

    let amount = 0;
    if (data.amount !== undefined && data.amount !== null && data.amount !== "") {
      amount = parseFloat(data.amount);
    } else {
      if (employee.salaryType === "daily" || employee.salaryType === "hourly") {
        let startDate = new Date();
        if (data.month) {
          const [y, m] = data.month.split("-").map(Number);
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
          amount = (present + 0.5 * halfDay) * (employee.salary || 0);
        } else {
          const totalHours = logs.reduce((sum, l) => sum + (l.hoursWorked || 0), 0);
          amount = totalHours * (employee.salary || 0);
        }
      } else {
        amount = employee.salary || 0;
      }
    }

    const salMonth = data.month || new Date().toISOString().slice(0, 7);
    const sharedRef = data.referenceNumber || `SAL-${id}-${salMonth}`;

    // Issue #70: Idempotency check — prevent double salary payment for the same month
    const existingPayment = await LedgerEntry.findOne({ referenceNumber: sharedRef, category: "salary" });
    if (existingPayment) {
      throw new ApiError(409, `Salary for ${salMonth} has already been processed for ${employee.name}. Reference: ${sharedRef}`);
    }

    // Issue #69: Calculate statutory payroll deductions
    const deductions = calculatePayrollDeductions(amount);

    // Bank balance check uses netPay (not gross) — that's what actually leaves the account
    if (data.bankAccountId) {
      const bankAccount = await BankAccount.findById(data.bankAccountId);
      if (!bankAccount) throw new Error("Bank account not found");
      if (bankAccount.balance < deductions.netPay) {
        throw new Error(`Insufficient funds: bank balance is PKR ${bankAccount.balance.toLocaleString()}, but net salary payout is PKR ${deductions.netPay.toLocaleString()} (gross PKR ${amount.toLocaleString()} minus PKR ${deductions.totalDeductions.toLocaleString()} deductions)`);
      }
    }

    let startDate = new Date();
    if (salMonth) {
      const [y, m] = salMonth.split("-").map(Number);
      startDate = new Date(y, m - 1, 1);
    } else {
      startDate = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    }
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const logs = await Attendance.find({ employeeId: id, date: { $gte: startDate, $lte: endDate } });
    
    const projectWeights: Record<string, number> = {};
    let totalWeightSum = 0;
    
    logs.forEach((log) => {
      const pId = log.projectId?.toString() || "overhead";
      let w = 0;
      if (employee.salaryType === "hourly") {
        w = log.hoursWorked || 0;
      } else {
        if (log.status === "present") w = 1;
        else if (log.status === "half_day") w = 0.5;
      }
      projectWeights[pId] = (projectWeights[pId] || 0) + w;
      totalWeightSum += w;
    });

    const ledgerDate = data.date ? new Date(data.date) : new Date();

    // Issue #75: Wrap all financial writes in a MongoDB transaction for atomicity
    const dbSession = await mongoose.startSession();
    dbSession.startTransaction();

    try {
      // Debit bank account with netPay (not gross)
      if (data.bankAccountId) {
        await BankAccount.findByIdAndUpdate(
          data.bankAccountId,
          { $inc: { balance: -deductions.netPay } },
          { session: dbSession }
        );
      }

      const salaryDesc = `Salary - ${employee.name} - ${salMonth} | Gross: PKR ${amount.toLocaleString()}, Net: PKR ${deductions.netPay.toLocaleString()} (EOBI: PKR ${deductions.eobiEmployee.toLocaleString()}, Tax: PKR ${deductions.incomeTaxMonthly.toLocaleString()})`;

      if (totalWeightSum > 0) {
        let allocatedSum = 0;
        for (const [pId, weight] of Object.entries(projectWeights)) {
          if (pId === "overhead") continue;
          const portion = (weight / totalWeightSum) * deductions.netPay;
          if (portion > 0) {
            allocatedSum += portion;
            await LedgerEntry.create([{
              date: ledgerDate,
              type: "expense",
              amount: portion,
              category: "salary",
              employeeId: id,
              description: `${salaryDesc} (Project portion)`,
              bankAccountId: data.bankAccountId || null,
              projectId: pId,
              createdById: session.user.id,
              referenceNumber: sharedRef,
              partyName: employee.name,
              partyType: "employee",
            }], { session: dbSession });
          }
        }
        const overheadPortion = deductions.netPay - allocatedSum;
        if (overheadPortion > 0.01) {
          await LedgerEntry.create([{
            date: ledgerDate,
            type: "expense",
            amount: overheadPortion,
            category: "salary",
            employeeId: id,
            description: `${salaryDesc} (Overhead/Office portion)`,
            bankAccountId: data.bankAccountId || null,
            projectId: null,
            createdById: session.user.id,
            referenceNumber: sharedRef,
            partyName: employee.name,
            partyType: "employee",
          }], { session: dbSession });
        }
      } else {
        await LedgerEntry.create([{
          date: ledgerDate,
          type: "expense",
          amount: deductions.netPay,
          category: "salary",
          employeeId: id,
          description: `${salaryDesc} (General Overhead)`,
          bankAccountId: data.bankAccountId || null,
          projectId: null,
          createdById: session.user.id,
          referenceNumber: sharedRef,
          partyName: employee.name,
          partyType: "employee",
        }], { session: dbSession });
      }

      // Record EOBI employer contribution as a separate company liability
      if (deductions.eobiEmployer > 0) {
        await LedgerEntry.create([{
          date: ledgerDate,
          type: "expense",
          amount: deductions.eobiEmployer,
          category: "eobi_contribution",
          employeeId: id,
          description: `EOBI employer contribution (5%) - ${employee.name} - ${salMonth}`,
          bankAccountId: null,
          projectId: null,
          createdById: session.user.id,
          referenceNumber: `${sharedRef}-EOBI`,
          partyName: employee.name,
          partyType: "employee",
        }], { session: dbSession });
      }

      await dbSession.commitTransaction();
    } catch (txErr) {
      await dbSession.abortTransaction();
      throw txErr;
    } finally {
      await dbSession.endSession();
    }

    await auditLog(session.user.id, "CREATE", "Salary", sharedRef, `Paid salary: ${employee.name} | Gross: PKR ${amount} | Net: PKR ${deductions.netPay} | EOBI: PKR ${deductions.eobiEmployee} | Tax: PKR ${deductions.incomeTaxMonthly}`);
    return ok({
      success: true,
      referenceNumber: sharedRef,
      grossAmount: amount,
      deductions: {
        eobiEmployee: deductions.eobiEmployee,
        eobiEmployer: deductions.eobiEmployer,
        incomeTax: deductions.incomeTaxMonthly,
        total: deductions.totalDeductions,
      },
      netPay: deductions.netPay,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
