import { connectDB } from "./mongoose";
import ProjectEquipment from "@/models/ProjectEquipment";
import Equipment from "@/models/Equipment";
import LedgerEntry from "@/models/LedgerEntry";
import User from "@/models/User";

export async function runEquipmentJobCosting(targetDate: Date = new Date()) {
  await connectDB();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  // Get first admin user to assign as creator
  const systemUser = await User.findOne({ role: { $in: ["admin", "ceo"] } });
  const systemUserId = systemUser ? systemUser._id : null;

  // Find all active equipment assignments during the target date
  const activeAssignments = await ProjectEquipment.find({
    assignedAt: { $lte: endOfDay },
    $or: [{ returnedAt: null }, { returnedAt: { $gte: startOfDay } }],
  }).populate("equipmentId");

  let count = 0;
  for (const assignment of activeAssignments) {
    const equipment = assignment.equipmentId as any;
    if (!equipment || !equipment.dailyRate || equipment.dailyRate <= 0) continue;
    if (equipment.status === "maintenance" || equipment.status === "decommissioned") continue;

    // Check if duplicate entry exists for this assignment on this day
    const duplicate = await LedgerEntry.findOne({
      projectId: assignment.projectId,
      category: "equipment_usage",
      referenceNumber: assignment._id.toString(),
      date: { $gte: startOfDay, $lte: endOfDay },
    });

    if (!duplicate) {
      await LedgerEntry.create({
        date: startOfDay,
        type: "expense",
        amount: equipment.dailyRate,
        category: "equipment_usage",
        description: `Daily usage expense for ${equipment.name} (${equipment.serialNumber || "No Serial"})`,
        projectId: assignment.projectId,
        createdById: systemUserId,
        referenceNumber: assignment._id.toString(),
      });
      count++;
    }
  }
  return count;
}
