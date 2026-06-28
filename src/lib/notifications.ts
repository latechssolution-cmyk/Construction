import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";
import User from "@/models/User";

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
