import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";
import Material from "@/models/Material";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const project = await Project.findById(id, { budget: 1, name: 1 });
    if (!project) throw new ApiError(404, "Project not found");

    const [tasks, milestones, materials, incomeAgg, expenseAgg] = await Promise.all([
      Task.find({ projectId: id }, { status: 1 }),
      Milestone.find({ projectId: id }, { completedAt: 1 }),
      Material.find({ projectId: id }, { stockQuantity: 1, minStockLevel: 1 }),
      LedgerEntry.aggregate([{ $match: { projectId: project._id, type: "income" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      LedgerEntry.aggregate([{ $match: { projectId: project._id, type: "expense" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
    ]);

    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpense = expenseAgg[0]?.total || 0;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const completedMilestones = milestones.filter((m) => m.completedAt).length;
    const lowStockCount = materials.filter((m) => m.stockQuantity <= m.minStockLevel).length;

    return ok({
      budget: project.budget,
      budgetUsed: totalExpense,
      budgetUsedPct: project.budget > 0 ? Math.round((totalExpense / project.budget) * 100) : 0,
      income: totalIncome,
      expense: totalExpense,
      profit: totalIncome - totalExpense,
      taskProgress: tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0,
      milestoneProgress: milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0,
      lowStockCount,
      totalTasks: tasks.length,
      completedTasks,
      totalMilestones: milestones.length,
      completedMilestones,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
