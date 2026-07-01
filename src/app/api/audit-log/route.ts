import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import AuditLog from "@/models/AuditLog";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { searchParams } = new URL(req.url);
    const auditModule = searchParams.get("module");
    const userId = searchParams.get("userId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const take = Math.min(parseInt(searchParams.get("take") || "100"), 500);
    const filter: any = {};
    if (auditModule) filter.module = auditModule;
    if (userId) filter.userId = userId;
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) filter.createdAt.$lte = new Date(to);
    }
    await connectDB();
    const logs = await AuditLog.find(filter)
      .populate("user", "id name email")
      .sort({ createdAt: -1 })
      .limit(take);
    return ok(logs);
  } catch (e) {
    return handleApiError(e);
  }
}
