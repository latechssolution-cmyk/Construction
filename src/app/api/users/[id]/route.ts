import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    if (session.user.id !== id && session.user.role !== "admin") {
      throw new ApiError(403, "Forbidden");
    }
    await connectDB();
    const user = await User.findById(id, { passwordHash: 0 });
    if (!user) throw new ApiError(404, "User not found");
    return ok(user);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const isSelf = session.user.id === id;
    const isAdmin = session.user.role === "admin";
    if (!isSelf && !isAdmin) throw new ApiError(403, "Forbidden");

    const data = await req.json();
    await connectDB();
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");
    if (data.name) user.name = data.name;
    if (data.image !== undefined) user.image = data.image;
    if (isAdmin) {
      if (data.role) {
        const VALID_ROLES = ["admin", "ceo", "manager", "accountant"];
        if (!VALID_ROLES.includes(data.role)) throw new ApiError(400, `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`);
        user.role = data.role;
      }
      if (data.isActive === false && isSelf) throw new ApiError(400, "Cannot deactivate your own account");
      if (data.isActive !== undefined) user.isActive = data.isActive;
    }
    await user.save();
    const result = user.toJSON();
    delete (result as any).passwordHash;
    void auditLog(session.user.id, "UPDATE", "User", id, `Updated user: ${user.email}`);
    return ok(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin");
    const { id } = await params;
    if (id === session.user.id) throw new ApiError(400, "Cannot deactivate your own account");
    await connectDB();
    const user = await User.findById(id);
    if (!user) throw new ApiError(404, "User not found");
    user.isActive = false;
    await user.save();
    void auditLog(session.user.id, "DELETE", "User", id, "Deactivated user");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
