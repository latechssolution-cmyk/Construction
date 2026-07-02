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
import { runEquipmentJobCosting } from "@/lib/equipment-job-costing";

export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    await connectDB();

    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [
      totalProjects, activeProjects, totalClients, totalEmployees, totalVendors,
      totalsAgg, statusBreakdown, recentActivity, trendAgg,
      overdueTasks, overdueInvoices,
    ] = await Promise.all([
      Project.countDocuments(),
      Project.countDocuments({ status: "in_progress" }),
      Client.countDocuments({ isActive: true }),
      Employee.countDocuments({ isActive: true }),
      Vendor.countDocuments({ isActive: true }),
      // Single aggregation for all-time income + expense totals
      LedgerEntry.aggregate([
        { $group: { _id: "$type", total: { $sum: "$amount" } } },
      ]),
      Project.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      AuditLog.find({}, { action: 1, module: 1, recordId: 1, details: 1, createdAt: 1 })
        .populate("user", "name").sort({ createdAt: -1 }).limit(10).lean({ virtuals: true }),
      // Single aggregation for 6-month revenue trend (replaces 12 separate queries)
      LedgerEntry.aggregate([
        { $match: { date: { $gte: sixMonthsAgo } } },
        {
          $group: {
            _id: { year: { $year: "$date" }, month: { $month: "$date" }, type: "$type" },
            total: { $sum: "$amount" },
          },
        },
      ]),
      Task.countDocuments({ status: { $ne: "completed" }, dueDate: { $lt: now } }),
      Invoice.countDocuments({ status: { $in: ["sent", "overdue"] }, dueDate: { $lt: now } }),
    ]);

    // Reconstruct totals
    const totalIncome = totalsAgg.find((r: any) => r._id === "income")?.total || 0;
    const totalExpense = totalsAgg.find((r: any) => r._id === "expense")?.total || 0;

    // Reconstruct 6-month trend from single aggregation result
    const trendMap: Record<string, { income: number; expense: number }> = {};
    for (const r of trendAgg as any[]) {
      const key = `${r._id.year}-${r._id.month}`;
      if (!trendMap[key]) trendMap[key] = { income: 0, expense: 0 };
      trendMap[key][r._id.type as "income" | "expense"] = r.total;
    }
    const revenueTrend = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      return {
        month: d.toLocaleString("default", { month: "short" }),
        income: trendMap[key]?.income || 0,
        expense: trendMap[key]?.expense || 0,
      };
    });

    // Portfolio: fetch top 20 projects with only needed fields, then aggregate in parallel
    const portfolioProjects = await Project.find(
      {},
      { name: 1, status: 1, budget: 1, completionPercent: 1 }
    ).sort({ createdAt: -1 }).limit(20).lean();
    const projectIds = portfolioProjects.map((p: any) => p._id);

    const [taskGroups, ledgerGroups] = await Promise.all([
      Task.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        { $group: { _id: "$projectId", tasks: { $push: { status: "$status", weight: "$weight" } } } },
      ]),
      LedgerEntry.aggregate([
        { $match: { projectId: { $in: projectIds }, type: "expense", category: { $ne: "inventory_asset" } } },
        { $group: { _id: "$projectId", total: { $sum: "$amount" } } },
      ]),
    ]);

    const taskMap = Object.fromEntries(taskGroups.map((r: any) => [r._id.toString(), r.tasks]));
    const expMap = Object.fromEntries(ledgerGroups.map((r: any) => [r._id.toString(), r.total]));

    const portfolio = (portfolioProjects as any[]).map((p: any) => {
      const tasksList: { status: string; weight?: number }[] = taskMap[p._id.toString()] || [];
      const total = tasksList.length;
      const done = tasksList.filter((t) => t.status === "completed").length;
      
      const totalWeight = tasksList.reduce((sum, t) => sum + (t.weight || 1), 0);
      const completedWeight = tasksList.filter(t => t.status === "completed").reduce((sum, t) => sum + (t.weight || 1), 0);
      const pct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
      
      const spent = expMap[p._id.toString()] || 0;
      const budgetPct = p.budget ? Math.round((spent / p.budget) * 100) : 0;
      
      let rag = "green";
      if (budgetPct > 100 || (budgetPct > 50 && pct < budgetPct - 35)) {
        rag = "red";
      } else if (budgetPct > 80 || budgetPct > pct + 20) {
        rag = "amber";
      }
      
      return { id: p._id.toString(), name: p.name, status: p.status, budget: p.budget, spent, pct, budgetPct, rag, tasksDone: done, tasksTotal: total };
    });

    return ok({
      totalProjects, activeProjects, totalClients, totalEmployees, totalVendors,
      totalIncome, totalExpense, overdueTasks, overdueInvoices,
      statusBreakdown: (statusBreakdown as any[]).map((s: any) => ({ status: s._id, count: s.count })),
      revenueTrend, recentActivity, portfolio,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
