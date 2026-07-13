import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";
import Material from "@/models/Material";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "manager");
    await connectDB();

    const projectFilter = { assignedManagerId: session.user.id };
    const projects = await Project.find(
      projectFilter,
      { name: 1, status: 1, completionPercent: 1, budget: 1, caValue: 1 }
    ).sort({ createdAt: -1 }).lean();
    const projectIds = projects.map((p: any) => p._id);
    const now = new Date();

    const [taskGroups, milestoneGroups, dueSoonTasks, upcomingMilestones, lowStockItems, expenseGroups] = await Promise.all([
      Task.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        { $group: { _id: "$projectId", tasks: { $push: { status: "$status", weight: "$weight" } } } },
      ]),
      Milestone.aggregate([
        { $match: { projectId: { $in: projectIds } } },
        { $group: { _id: "$projectId", completedAts: { $push: "$completedAt" } } },
      ]),
      Task.find(
        { projectId: { $in: projectIds }, status: { $ne: "completed" }, dueDate: { $lte: new Date(Date.now() + 7 * 86400000) } },
        { title: 1, dueDate: 1, projectId: 1, priority: 1 }
      ).populate("project", "name").sort({ dueDate: 1 }).limit(10).lean({ virtuals: true }),
      Milestone.find(
        { projectId: { $in: projectIds }, completedAt: null, dueDate: { $lte: new Date(Date.now() + 30 * 86400000), $gte: now } },
        { name: 1, dueDate: 1, projectId: 1 }
      ).populate("project", "name").sort({ dueDate: 1 }).limit(10).lean({ virtuals: true }),
      // Filter low-stock in MongoDB — $expr compares two fields in same document
      Material.find(
        { projectId: { $in: projectIds }, $expr: { $lte: ["$stockQuantity", "$minStockLevel"] } },
        { itemName: 1, stockQuantity: 1, minStockLevel: 1, unit: 1, projectId: 1 }
      ).populate("project", "name").limit(10).lean({ virtuals: true }),
      // Managers can already see per-project budget/expense on their own
      // projects' Overview & Finance tabs (assertManagerOwnsProject-gated) —
      // this surfaces the same derived totals on the dashboard without
      // exposing raw ledger entries (which stay finance-role-only).
      LedgerEntry.aggregate([
        { $match: { projectId: { $in: projectIds }, type: "expense", category: { $ne: "inventory_asset" } } },
        { $group: { _id: "$projectId", total: { $sum: "$amount" } } },
      ]),
    ]);

    const taskMap = Object.fromEntries(taskGroups.map((r: any) => [r._id.toString(), r.tasks]));
    const expenseMap = Object.fromEntries(expenseGroups.map((r: any) => [r._id.toString(), r.total]));

    const projectProgress = (projects as any[]).map((p: any) => {
      const tasksList: { status: string; weight?: number }[] = taskMap[p._id.toString()] || [];
      const total = tasksList.length;
      const done = tasksList.filter((t) => t.status === "completed").length;

      const totalWeight = tasksList.reduce((sum, t) => sum + (t.weight || 1), 0);
      const completedWeight = tasksList.filter(t => t.status === "completed").reduce((sum, t) => sum + (t.weight || 1), 0);
      const taskProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

      const key = p._id.toString();
      const spent = expenseMap[key] || 0;
      const caValue = p.caValue > 0 ? p.caValue : (p.budget || 0);

      return {
        id: key,
        name: p.name,
        status: p.status,
        completionPercent: Math.round(p.completionPercent || 0),
        taskProgress,
        tasksDone: done,
        tasksTotal: total,
        caValue,
        budget: p.budget || 0,
        spent,
        budgetPct: p.budget > 0 ? Math.round((spent / p.budget) * 100) : 0,
      };
    });

    const totalCAValue = projectProgress.reduce((sum, p) => sum + p.caValue, 0);
    const totalBudget = projectProgress.reduce((sum, p) => sum + p.budget, 0);
    const totalSpent = projectProgress.reduce((sum, p) => sum + p.spent, 0);

    // .lean() skips the schema's toJSON transform (that only runs on real
    // Mongoose documents), so these three lists come back with `_id`, not
    // `id` — the frontend keys its lists by `.id`, which was silently
    // undefined for every row (React "missing key" warning, and any code
    // that ever needs to build a link from these needs a real id too).
    const withId = (rows: any[]) => rows.map((r) => ({ ...r, id: r._id.toString() }));

    return ok({
      myProjectsCount: projects.length,
      activeProjectsCount: (projects as any[]).filter((p: any) => p.status === "ongoing").length,
      dueSoonTasks: withId(dueSoonTasks),
      upcomingMilestones: withId(upcomingMilestones),
      lowStockItems: withId(lowStockItems),
      projectProgress,
      totalCAValue, totalBudget, totalSpent,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
