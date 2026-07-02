import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";
import User from "@/models/User";
import mongoose from "mongoose";

export async function createNotification(
  userId: string,
  title: string,
  message: string,
  type: "alert" | "info" | "warning" | "success" = "info"
) {
  try {
    await connectDB();
    await Notification.create({ userId, title, message, type });
  } catch {
    console.error("[Notification] Failed to create:", { userId, title });
  }
}

export async function checkBudgetAlert(projectId: string | null | undefined, newExpenseAmount: number) {
  if (!projectId) return;
  try {
    await connectDB();
    const Project = mongoose.models.Project;
    const LedgerEntry = mongoose.models.LedgerEntry;
    if (!Project || !LedgerEntry) return;
    const project = await Project.findById(projectId, { budget: 1, name: 1 });
    if (!project || !project.budget || project.budget <= 0) return;
    const agg = await LedgerEntry.aggregate([
      { $match: { projectId: project._id, type: "expense", category: { $ne: "inventory_asset" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpense = (agg[0]?.total || 0) + newExpenseAmount;
    const pct = (totalExpense / project.budget) * 100;
    if (pct >= 90) {
      await notifyAdminsAndManagers(
        "Budget Alert",
        `Project "${project.name}" has used ${pct.toFixed(0)}% of budget`,
        "warning"
      );
    }
  } catch {
    // Non-critical — don't break the request
  }
}

export async function notifyAdminsAndManagers(
  title: string,
  message: string,
  type: "alert" | "info" | "warning" | "success" = "warning"
) {
  try {
    await connectDB();
    const targets = await User.find(
      { isActive: true, role: { $in: ["admin", "manager"] } },
      { _id: 1 }
    ).lean();
    if (targets.length > 0) {
      await Notification.insertMany(
        targets.map((u) => ({ userId: u._id, title, message, type }))
      );
    }
  } catch {
    console.error("[Notification] Failed to notify admins/managers");
  }
}
