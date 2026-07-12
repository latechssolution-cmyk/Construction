import { requireAuth, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";
import Material from "@/models/Material";
import { runEquipmentJobCosting } from "@/lib/equipment-job-costing";

export async function GET() {
  try {
    const session = await requireAuth();
    const isManager = session.user.role === "manager";
    await connectDB();

    const projectFilter = isManager ? { assignedManagerId: session.user.id } : {};
    const projects = await Project.find(
      projectFilter,
      { name: 1, status: 1, completionPercent: 1, budget: 1 }
    ).sort({ createdAt: -1 }).lean();
    const projectIds = projects.map((p: any) => p._id);
    const now = new Date();

    const [taskGroups, milestoneGroups, dueSoonTasks, upcomingMilestones, lowStockItems] = await Promise.all([
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
    ]);

    const taskMap = Object.fromEntries(taskGroups.map((r: any) => [r._id.toString(), r.tasks]));

    const projectProgress = (projects as any[]).map((p: any) => {
      const tasksList: { status: string; weight?: number }[] = taskMap[p._id.toString()] || [];
      const total = tasksList.length;
      const done = tasksList.filter((t) => t.status === "completed").length;
      
      const totalWeight = tasksList.reduce((sum, t) => sum + (t.weight || 1), 0);
      const completedWeight = tasksList.filter(t => t.status === "completed").reduce((sum, t) => sum + (t.weight || 1), 0);
      const taskProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

      return {
        id: p._id.toString(),
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
      activeProjectsCount: (projects as any[]).filter((p: any) => p.status === "ongoing").length,
      dueSoonTasks,
      upcomingMilestones,
      lowStockItems,
      projectProgress,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
