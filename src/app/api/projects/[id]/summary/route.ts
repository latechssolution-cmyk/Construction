import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok, assertManagerOwnsProject } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";
import Material from "@/models/Material";
import LedgerEntry from "@/models/LedgerEntry";
import Subcontract from "@/models/Subcontract";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    const project = await Project.findById(id, { budget: 1, name: 1, assignedManagerId: 1 });
    assertManagerOwnsProject(session, project);

    const [tasks, milestones, materials, incomeAgg, expenseAgg, subcontracts] = await Promise.all([
      Task.find({ projectId: id }, { status: 1, weight: 1 }),
      Milestone.find({ projectId: id }, { completedAt: 1 }),
      Material.find({ projectId: id }, { stockQuantity: 1, minStockLevel: 1 }),
      LedgerEntry.aggregate([{ $match: { projectId: project._id, type: "income" } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      LedgerEntry.aggregate([{ $match: { projectId: project._id, type: "expense", category: { $ne: "inventory_asset" } } }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
      Subcontract.find({ projectId: id }, { contractValue: 1, status: 1 }),
    ]);

    const totalIncome = incomeAgg[0]?.total || 0;
    const totalExpense = expenseAgg[0]?.total || 0;
    const completedTasks = tasks.filter((t) => t.status === "completed").length;
    const completedMilestones = milestones.filter((m) => m.completedAt).length;
    const lowStockCount = materials.filter((m) => m.stockQuantity <= m.minStockLevel).length;

    const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || 1), 0);
    const completedWeight = tasks.filter(t => t.status === "completed").reduce((sum, t) => sum + (t.weight || 1), 0);
    const taskProgress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

    // Subcontract commitments are separate from actual cash expense (a
    // subcontract sets a ceiling; the vendor is actually paid via ledger
    // entries as work progresses) — surfaced here so the value isn't
    // invisible everywhere outside its own tab.
    const totalSubcontractValue = subcontracts.reduce((sum, s) => sum + (s.contractValue || 0), 0);
    const completedSubcontractValue = subcontracts.filter(s => s.status === "completed").reduce((sum, s) => sum + (s.contractValue || 0), 0);

    return ok({
      budget: project.budget,
      budgetUsed: totalExpense,
      budgetUsedPct: project.budget > 0 ? Math.round((totalExpense / project.budget) * 100) : 0,
      income: totalIncome,
      expense: totalExpense,
      profit: totalIncome - totalExpense,
      taskProgress,
      milestoneProgress: milestones.length > 0 ? Math.round((completedMilestones / milestones.length) * 100) : 0,
      lowStockCount,
      totalTasks: tasks.length,
      completedTasks,
      totalMilestones: milestones.length,
      completedMilestones,
      totalSubcontracts: subcontracts.length,
      totalSubcontractValue,
      completedSubcontractValue,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
