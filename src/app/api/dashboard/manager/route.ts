import { requireAuth, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";
import Material from "@/models/Material";

export async function GET() {
  try {
    const session = await requireAuth();
    const isManager = session.user.role === "manager";
    await connectDB();
    const projectFilter = isManager ? { assignedManagerId: session.user.id } : {};
    const projects = await Project.find(projectFilter).sort({ createdAt: -1 });
    const projectIds = projects.map((p) => p._id);
    const now = new Date();

    const [taskGroups, milestoneGroups, dueSoonTasks, upcomingMilestones, allMaterials] = await Promise.all([
      Task.aggregate([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: "$projectId", statuses: { $push: "$status" } } }]),
      Milestone.aggregate([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: "$projectId", completedAts: { $push: "$completedAt" } } }]),
      Task.find({
        projectId: { $in: projectIds },
        status: { $ne: "completed" },
        dueDate: { $lte: new Date(Date.now() + 7 * 86400000), $gte: now },
      }).populate("project", "name").sort({ dueDate: 1 }).limit(10),
      Milestone.find({
        projectId: { $in: projectIds },
        completedAt: null,
        dueDate: { $lte: new Date(Date.now() + 30 * 86400000), $gte: now },
      }).populate("project", "name").sort({ dueDate: 1 }).limit(10),
      Material.find({ projectId: { $in: projectIds } }).populate("project", "name"),
    ]);

    const taskMap = Object.fromEntries(taskGroups.map((r: any) => [r._id.toString(), r.statuses]));
    const mileMap = Object.fromEntries(milestoneGroups.map((r: any) => [r._id.toString(), r.completedAts]));
    const lowStock = allMaterials.filter((m) => m.stockQuantity <= m.minStockLevel);

    const projectProgress = projects.map((p) => {
      const statuses: string[] = taskMap[p.id] || [];
      const total = statuses.length;
      const done = statuses.filter((s) => s === "completed").length;
      const taskProgress = total > 0 ? Math.round((done / total) * 100) : 0;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        completionPercent: Math.round(p.completionPercent || 0),
        taskProgress,
        tasksDone: done,
        tasksTotal: total,
      };
    });

    return ok({
      myProjectsCount: projects.length,
      activeProjectsCount: projects.filter((p) => p.status === "in_progress").length,
      dueSoonTasks,
      upcomingMilestones,
      lowStockItems: lowStock.slice(0, 10),
      projectProgress,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
