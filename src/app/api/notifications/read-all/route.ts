import { requireAuth, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";

export async function POST() {
  try {
    const session = await requireAuth();
    await connectDB();
    await Notification.updateMany({ userId: session.user.id, isRead: false }, { isRead: true });
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
