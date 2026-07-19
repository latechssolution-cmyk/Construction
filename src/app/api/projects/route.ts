import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import { assertDateRange, parseOptionalDate, parseRequiredNonNegativeNumber } from "@/lib/validation";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";
import Material from "@/models/Material";
import Doc from "@/models/Document";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const filter: any = {};
    if (session.user.role === "manager") filter.assignedManagerId = session.user.id;
    if (status) filter.status = status;

    await connectDB();
    const projects = await Project.find(filter)
      .populate("client", "id name")
      .populate("assignedManager", "id name")
      .sort({ createdAt: -1 })
      .limit(500)
      .lean({ virtuals: true });

    const ids = (projects as any[]).map((p: any) => p._id);
    const [taskGroups, milestoneGroups, matCounts, docCounts, ledgerGroups] = await Promise.all([
      Task.aggregate([{ $match: { projectId: { $in: ids } } }, { $group: { _id: "$projectId", tasks: { $push: { status: "$status", weight: "$weight" } } } }]),
      Milestone.aggregate([{ $match: { projectId: { $in: ids } } }, { $group: { _id: "$projectId", completedAts: { $push: "$completedAt" } } }]),
      Material.aggregate([{ $match: { projectId: { $in: ids } } }, { $group: { _id: "$projectId", count: { $sum: 1 } } }]),
      Doc.aggregate([{ $match: { projectId: { $in: ids } } }, { $group: { _id: "$projectId", count: { $sum: 1 } } }]),
      LedgerEntry.aggregate([
        { $match: { projectId: { $in: ids } } },
        {
          $group: {
            _id: "$projectId",
            income: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "income"] }, { $ne: ["$category", "inventory_asset"] }] }, "$amount", 0] } },
            expense: { $sum: { $cond: [{ $and: [{ $eq: ["$type", "expense"] }, { $ne: ["$category", "inventory_asset"] }] }, "$amount", 0] } }
          }
        }
      ])
    ]);
    const taskMap = Object.fromEntries(taskGroups.map((r: any) => [r._id.toString(), r.tasks]));
    const mileMap = Object.fromEntries(milestoneGroups.map((r: any) => [r._id.toString(), r.completedAts.map((ca: any) => ({ completedAt: ca }))]));
    const matMap = Object.fromEntries(matCounts.map((r: any) => [r._id.toString(), r.count]));
    const docMap = Object.fromEntries(docCounts.map((r: any) => [r._id.toString(), r.count]));
    const ledgerMap = Object.fromEntries(ledgerGroups.map((r: any) => [r._id.toString(), { income: r.income, expense: r.expense }]));

    const result = (projects as any[]).map((p: any) => {
      const id = p._id?.toString() || p.id;
      const ledger = ledgerMap[id] || { income: 0, expense: 0 };
      return {
        ...p,
        id,
        tasks: taskMap[id] || [],
        milestones: mileMap[id] || [],
        _count: { materials: matMap[id] || 0, documents: docMap[id] || 0 },
        actualRevenue: ledger.income,
        actualExpense: ledger.expense,
        actualProfit: ledger.income - ledger.expense,
      };
    });
    return ok(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();
    if (!data.name) throw new Error("Project name is required");
    const budget = parseRequiredNonNegativeNumber(data.budget || "0", "Budget");
    const caValue = parseRequiredNonNegativeNumber(data.caValue || "0", "CA Value");
    const startDate = parseOptionalDate(data.startDate, "Start date") ?? null;
    const endDate = parseOptionalDate(data.endDate, "End date") ?? null;
    assertDateRange(startDate, endDate);
    const PROJECT_STATUSES = ["planning", "ongoing", "physically_closed", "financially_closed", "sick", "cancelled"];
    const status = data.status && PROJECT_STATUSES.includes(data.status) ? data.status : "planning";
    await connectDB();
    const project = await Project.create({
      name: data.name,
      location: data.location || null,
      type: data.type || "residential",
      status,
      budget,
      caValue,
      salients: data.salients || null,
      description: data.description || null,
      startDate,
      endDate,
      clientId: toId(data.clientId),
      contractId: toId(data.contractId),
      assignedManagerId: toId(data.assignedManagerId) || session.user.id,
      createdById: session.user.id,
    });
    await project.populate("client", "name");
    void auditLog(session.user.id, "CREATE", "Project", project.id, `Created project: ${project.name}`);
    void notifyAdminsAndManagers("New Project Created", `Project "${project.name}" has been created`, "info");
    return created(project);
  } catch (e) {
    return handleApiError(e);
  }
}
