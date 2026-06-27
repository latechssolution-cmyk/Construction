import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const rl = rateLimit(`pwreset:${id}`, { limit: 5, windowSec: 3600 });
    if (!rl.success) throw new ApiError(429, "Too many password reset attempts. Try again in 1 hour.");

    if (session.user.role !== "admin" && session.user.id !== id) {
      throw new ApiError(403, "Forbidden");
    }

    const data = await req.json();
    await connectDB();

    if (session.user.id === id && session.user.role !== "admin") {
      if (!data.currentPassword) throw new ApiError(400, "Current password is required");
      const user = await User.findById(id, { passwordHash: 1 });
      if (!user?.passwordHash) throw new ApiError(400, "No password set for this account");
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) throw new ApiError(400, "Current password is incorrect");
    }

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new ApiError(400, "New password must be at least 8 characters");
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    await User.findByIdAndUpdate(id, { passwordHash });
    await auditLog(session.user.id, "UPDATE", "User", id, "Password reset");
    return ok({ success: true, message: "Password updated successfully" });
  } catch (e) {
    return handleApiError(e);
  }
}
