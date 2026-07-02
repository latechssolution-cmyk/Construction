import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Project from "@/models/Project";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const bankAccountId = searchParams.get("bankAccountId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (bankAccountId) filter.bankAccountId = bankAccountId;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    await connectDB();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const skip = (page - 1) * limit;

    const total = await LedgerEntry.countDocuments(filter);
    const entries = await LedgerEntry.find(filter)
      .populate("project", "id name")
      .populate("bankAccount", "id name")
      .populate("vendor", "id name")
      .populate("createdBy", "id name")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    return ok({
      data: entries,
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
    await connectDB();
    const amount = parseFloat(data.amount);
    const entry = await LedgerEntry.create({
      date: new Date(data.date),
      type: data.type,
      amount,
      category: data.category,
      description: data.description || null,
      referenceNumber: data.referenceNumber || null,
      projectId: toId(data.projectId),
      bankAccountId: toId(data.bankAccountId),
      vendorId: toId(data.vendorId),
      partyName: data.partyName || null,
      partyType: data.partyType || "other",
      receiptPath: data.receiptPath || null,
      createdById: session.user.id,
    });
    if (data.bankAccountId) {
      const delta = data.type === "income" ? amount : -amount;
      await BankAccount.findByIdAndUpdate(data.bankAccountId, { $inc: { balance: delta } });
    }
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
    await auditLog(session.user.id, "CREATE", "LedgerEntry", entry.id, `${data.type} PKR ${amount}`);
    return created(entry);
  } catch (e) {
    return handleApiError(e);
  }
}
