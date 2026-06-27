import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Client from "@/models/Client";
import Employee from "@/models/Employee";
import Vendor from "@/models/Vendor";
import LedgerEntry from "@/models/LedgerEntry";
import AuditLog from "@/models/AuditLog";
import Task from "@/models/Task";
import Invoice from "@/models/Invoice";

export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    await connectDB();

    const now = new Date();
    const [
      totalProjects, activeProjects, totalClients, totalEmployees, totalVendors,
      incomeAgg, expenseAgg, statusBreakdown, recentActivity,
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: "in_progress" }),
      Client.countDocuments({ isActive: true }),
      Employee.countDocuments({ isActive: true }),
      Vendor.countDocuments({ isActive: true }),
      LedgerEntry.aggregate([{ $match: { type: "income" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      LedgerEntry.aggregate([{ $match: { type: "expense" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Project.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      AuditLog.find({}).populate("user", "name").sort({ createdAt: -1 }).limit(10),
    ]);

    const revenueTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
        const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        return Promise.all([
          LedgerEntry.aggregate([{ $match: { type: "income", date: { $gte: d, $lt: next } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
          LedgerEntry.aggregate([{ $match: { type: "expense", date: { $gte: d, $lt: next } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
        ]).then(([inc, exp]) => ({
          month: d.toLocaleString("default", { month: "short" }),
          income: inc[0]?.total || 0,
          expense: exp[0]?.total || 0,
        }));
      })
    );

    const portfolioProjects = await Project.find({}).sort({ createdAt: -1 }).limit(20);
    const projectIds = portfolioProjects.map((p) => p._id);
    const [taskGroups, ledgerGroups] = await Promise.all([
      Task.aggregate([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: "$projectId", statuses: { $push: "$status" } } }]),
      LedgerEntry.aggregate([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: { projectId: "$projectId", type: "$type" }, total: { $sum: "$amount" } } }]),
    ]);
    const taskMap = Object.fromEntries(taskGroups.map((r: any) => [r._id.toString(), r.statuses]));
    const expMap: Record<string, number> = {};
    ledgerGroups.forEach((r: any) => {
      if (r._id.type === "expense") expMap[r._id.projectId.toString()] = r.total;
    });

    const portfolio = portfolioProjects.map((p) => {
      const statuses: string[] = taskMap[p.id] || [];
      const total = statuses.length;
      const done = statuses.filter((s) => s === "completed").length;
      const pct = total > 0 ? Math.round(done / total * 100) : 0;
      const spent = expMap[p.id] || 0;
      const budgetPct = p.budget ? Math.round(spent / p.budget * 100) : 0;
      const rag = budgetPct > 100 ? "red" : budgetPct > 80 ? "amber" : "green";
      return { id: p.id, name: p.name, status: p.status, budget: p.budget, spent, pct, budgetPct, rag, tasksDone: done, tasksTotal: total };
    });

    const [overdueTasks, overdueInvoices] = await Promise.all([
      Task.countDocuments({ status: { $ne: "completed" }, dueDate: { $lt: now } }),
      Invoice.countDocuments({ status: { $in: ["sent","overdue"] }, dueDate: { $lt: now } }),
    ]);

    return ok({
      totalProjects, activeProjects, totalClients, totalEmployees, totalVendors,
      totalIncome: incomeAgg[0]?.total || 0,
      totalExpense: expenseAgg[0]?.total || 0,
      overdueTasks,
      overdueInvoices,
      statusBreakdown: statusBreakdown.map((s: any) => ({ status: s._id, count: s.count })),
      revenueTrend,
      recentActivity,
      portfolio,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
