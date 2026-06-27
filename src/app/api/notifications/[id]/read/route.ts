import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Notification from "@/models/Notification";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    const notification = await Notification.findById(id);
    if (!notification) throw new ApiError(404, "Notification not found");
    if (notification.userId?.toString() !== session.user.id) throw new ApiError(403, "Forbidden");
    notification.isRead = true;
    await notification.save();
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
