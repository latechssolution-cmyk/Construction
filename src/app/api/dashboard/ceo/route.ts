import { NextResponse } from "next/server";
import { requireAuth, requireRole, handleApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import LedgerEntry from "@/models/LedgerEntry";
import Employee from "@/models/Employee";
import Invoice from "@/models/Invoice";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";

export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    await connectDB();

    const [projects, employees, invoices] = await Promise.all([
      Project.find({}).sort({ startDate: -1 }),
      Employee.find({ isActive: true }, { id: 1, name: 1, role: 1, salary: 1, department: 1 }),
      Invoice.find({ status: { $in: ["sent","overdue"] } }).populate("client", "name").sort({ dueDate: 1 }).limit(10),
    ]);

    const projectIds = projects.map((p) => p._id);
    const [taskGroups, milestoneGroups, ledgerGroups, clientDocs] = await Promise.all([
      Task.aggregate([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: "$projectId", statuses: { $push: "$status" } } }]),
      Milestone.aggregate([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: "$projectId", completedAts: { $push: "$completedAt" } } }]),
      LedgerEntry.aggregate([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: { projectId: "$projectId", type: "$type" }, total: { $sum: "$amount" } } }]),
      (await import("@/models/Client")).default.find({}, { _id: 1, name: 1 }),
    ]);

    const taskMap = Object.fromEntries(taskGroups.map((r: any) => [r._id.toString(), r.statuses]));
    const mileMap = Object.fromEntries(milestoneGroups.map((r: any) => [r._id.toString(), r.completedAts]));
    const clientMap = Object.fromEntries((clientDocs as any[]).map((c: any) => [c._id.toString(), c.name]));
    const incMap: Record<string, number> = {};
    const expMap: Record<string, number> = {};
    ledgerGroups.forEach((r: any) => {
      if (r._id.type === "income") incMap[r._id.projectId.toString()] = r.total;
      if (r._id.type === "expense") expMap[r._id.projectId.toString()] = r.total;
    });

    const totalIncome = Object.values(incMap).reduce((a, b) => a + b, 0);
    const totalExpense = Object.values(expMap).reduce((a, b) => a + b, 0);
    const totalPayroll = employees.reduce((s, e) => s + e.salary, 0);

    const projectSummary = projects.map((p) => {
      const statuses: string[] = taskMap[p.id] || [];
      const milestoneAts: any[] = mileMap[p.id] || [];
      const income = incMap[p.id] || 0;
      const expense = expMap[p.id] || 0;
      const completedTasks = statuses.filter((s) => s === "completed").length;
      const completedMilestones = milestoneAts.filter((m) => m).length;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        client: clientMap[p.clientId?.toString() || ""] || null,
        budget: p.budget,
        income,
        expense,
        profit: income - expense,
        taskProgress: statuses.length ? Math.round((completedTasks / statuses.length) * 100) : 0,
        milestoneProgress: milestoneAts.length ? Math.round((completedMilestones / milestoneAts.length) * 100) : 0,
      };
    });

    const categoryAgg = await LedgerEntry.aggregate([
      { $match: { type: "expense" } },
      { $group: { _id: "$category", value: { $sum: "$amount" } } },
    ]);
    const expenseByCategory = categoryAgg.map((r: any) => ({ name: r._id, value: r.value }));

    return NextResponse.json({
      stats: {
        totalProjects: projects.length,
        activeProjects: projects.filter((p) => p.status === "in_progress").length,
        totalIncome,
        totalExpense,
        netProfit: totalIncome - totalExpense,
        totalPayroll,
        pendingInvoicesCount: invoices.length,
      },
      projectSummary,
      expenseByCategory,
      pendingInvoices: invoices,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
