import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import bcrypt from "bcryptjs";

export async function GET() {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    await connectDB();
    const users = await User.find(
      {},
      { name: 1, email: 1, role: 1, isActive: 1, image: 1, createdAt: 1, lastLoginAt: 1 }
    ).sort({ createdAt: -1 }).limit(500);
    return ok(users);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin");
    const data = await req.json();
    if (!data.id) throw new Error("id is required");
    if (data.id === session.user.id && data.isActive === false) {
      throw new Error("Cannot deactivate your own account");
    }
    await connectDB();
    const user = await User.findByIdAndUpdate(data.id, { isActive: data.isActive }, { new: true, select: "-passwordHash" });
    if (!user) throw new Error("User not found");
    await auditLog(session.user.id, "UPDATE", "User", data.id, `${data.isActive ? "Activated" : "Deactivated"} user: ${user.email}`);
    return ok(user);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin");
    const data = await req.json();
    if (!data.name || !data.email || !data.password) throw new Error("name, email and password are required");
    // Issue #77: Enforce password strength — minimum 8 chars, 1 uppercase, 1 number
    if (data.password.length < 8) throw new Error("Password must be at least 8 characters long");
    if (!/[A-Z]/.test(data.password)) throw new Error("Password must contain at least one uppercase letter");
    if (!/[0-9]/.test(data.password)) throw new Error("Password must contain at least one number");
    await connectDB();
    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({
      name: data.name,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role || "manager",
      isActive: true,
    });
    const result = user.toJSON();
    delete (result as any).passwordHash;
    await auditLog(session.user.id, "CREATE", "User", user.id, `Created user: ${user.email} (${user.role})`);
    return created(result);
  } catch (e) {
    return handleApiError(e);
  }
}
