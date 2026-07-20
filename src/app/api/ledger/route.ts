import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Project from "@/models/Project";

import mongoose from "mongoose";
import Subcontract from "@/models/Subcontract";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const bankAccountId = searchParams.get("bankAccountId");
    const employeeId = searchParams.get("employeeId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (bankAccountId) filter.bankAccountId = bankAccountId;
    if (employeeId) filter.employeeId = employeeId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    await connectDB();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const skip = (page - 1) * limit;

    // Aggregate $match doesn't cast string ids the way find() does — build a
    // casted copy of the filter for the totals pipeline.
    const aggMatch: any = { ...filter };
    for (const key of ["projectId", "bankAccountId", "employeeId"]) {
      if (aggMatch[key]) aggMatch[key] = new mongoose.Types.ObjectId(String(aggMatch[key]));
    }

    const [total, entries, totalsAgg] = await Promise.all([
      LedgerEntry.countDocuments(filter),
      LedgerEntry.find(filter)
        .populate("project", "id name")
        .populate("bankAccount", "id name")
        .populate("vendor", "id name")
        .populate("employee", "id name role")
        .populate("createdBy", "id name")
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit),
      // True totals over ALL matching entries — the page-level cards used to
      // sum only the 50 visible rows, so any ledger past one page showed a
      // wrong Total Income / Expense / Net Balance. inventory_asset offsets
      // are balance-sheet moves and excluded, matching every other P&L figure.
      LedgerEntry.aggregate([
        { $match: aggMatch },
        {
          $group: {
            _id: null,
            income: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "income"] }, { $ne: ["$category", "inventory_asset"] }] }, "$amount", 0] } },
            expense: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "expense"] }, { $ne: ["$category", "inventory_asset"] }] }, "$amount", 0] } },
          },
        },
      ]),
    ]);

    const totalsRow = (totalsAgg as any[])[0] || {};

    return ok({
      data: entries,
      totals: { income: totalsRow.income || 0, expense: totalsRow.expense || 0 },
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const data = await req.json();
    if (!data.date || !data.type || !data.amount || !data.category) {
      throw new Error("date, type, amount, and category are required");
    }
    const amount = parseFloat(data.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100_000_000_000) {
      throw new ApiError(400, "amount must be a positive number no greater than 100,000,000,000");
    }
    if (!["income", "expense"].includes(data.type)) {
      throw new ApiError(400, "type must be 'income' or 'expense'");
    }
    const entryDate = new Date(data.date);
    if (isNaN(entryDate.getTime())) throw new ApiError(400, "Invalid date");
    // Server-side date sanity — the UI blocks future dates but other entry
    // points didn't, which is how a typo like year "20206" reached the ledger.
    const tomorrow = new Date(); tomorrow.setHours(23, 59, 59, 999);
    if (entryDate > tomorrow) throw new ApiError(400, "Date cannot be in the future");
    if (entryDate.getFullYear() < 2000) throw new ApiError(400, "Date is unrealistically old — check the year");
    await connectDB();
    const bankAccountId = toId(data.bankAccountId);

    // Double-submit guard: identical entry by the same user within the last
    // 15s is a repeated click on a slow connection, not a second payment —
    // each duplicate here also duplicates the bank-balance mutation.
    const recentDuplicate = await LedgerEntry.findOne({
      type: data.type,
      amount,
      category: data.category,
      createdById: session.user.id,
      createdAt: { $gte: new Date(Date.now() - 15_000) },
    });
    if (recentDuplicate) {
      throw new ApiError(409, "An identical entry was just recorded - duplicate submission ignored.");
    }
    const entry = await withTransaction(async (dbSession) => {
      const [createdEntry] = await LedgerEntry.create(
        [{
          date: entryDate,
          type: data.type,
          amount,
          category: data.category,
          description: data.description || null,
          referenceNumber: data.referenceNumber || null,
          projectId: toId(data.projectId),
          bankAccountId,
          vendorId: toId(data.vendorId),
          partyName: data.partyName || null,
          partyType: data.partyType || "other",
          receiptPath: data.receiptPath || null,
          createdById: session.user.id,
        }],
        { session: dbSession }
      );
      if (bankAccountId) {
        const delta = data.type === "income" ? amount : -amount;
        await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: delta } }, { session: dbSession });
      }
      return createdEntry;
    });
    if (data.projectId && data.type === "expense") {
      const project = await Project.findById(data.projectId, { budget: 1, name: 1 });
      if (project && project.budget > 0) {
        const agg = await LedgerEntry.aggregate([
          { $match: { projectId: project._id, type: "expense" } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        const totalExpense = agg[0]?.total || 0;
        const pct = (totalExpense / project.budget) * 100;
        if (pct >= 90) {
          await notifyAdminsAndManagers("Budget Alert", `Project "${project.name}" has used ${pct.toFixed(0)}% of budget`, "warning");
        }
      }
    }
    void auditLog(session.user.id, "CREATE", "LedgerEntry", entry.id, `${data.type} PKR ${amount}`);
    return created(entry);
  } catch (e) {
    return handleApiError(e);
  }
}
