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

    if (!["admin", "ceo"].includes(session.user.role) && session.user.id !== id) {
      throw new ApiError(403, "Forbidden");
    }

    const data = await req.json();
    await connectDB();

    if (session.user.id === id && !["admin", "ceo"].includes(session.user.role)) {
      if (!data.currentPassword) throw new ApiError(400, "Current password is required");
      const user = await User.findById(id, { passwordHash: 1 });
      if (!user?.passwordHash) throw new ApiError(400, "No password set for this account");
      const valid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!valid) throw new ApiError(400, "Current password is incorrect");
    }

    if (!data.newPassword || data.newPassword.length < 8) {
      throw new ApiError(400, "New password must be at least 8 characters");
    }
    if (!/[A-Z]/.test(data.newPassword)) {
      throw new ApiError(400, "New password must contain at least one uppercase letter");
    }
    if (!/[0-9]/.test(data.newPassword)) {
      throw new ApiError(400, "New password must contain at least one number");
    }

    const passwordHash = await bcrypt.hash(data.newPassword, 12);
    // Issue #89: Set passwordChangedAt to invalidate any JWTs issued before this point
    await User.findByIdAndUpdate(id, { passwordHash, passwordChangedAt: new Date() });
    void auditLog(session.user.id, "UPDATE", "User", id, "Password reset — all existing sessions invalidated");
    return ok({ success: true, message: "Password updated successfully. Please log in again on all devices." });
  } catch (e) {
    return handleApiError(e);
  }
}
