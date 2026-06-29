import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import AuditLog from "@/models/AuditLog";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") || "";
    const entityId = searchParams.get("entityId") || "";
    const take = parseInt(searchParams.get("take") || "50");
    await connectDB();
    const filter: any = {};
    if (entity) filter.module = entity;
    if (entityId) filter.recordId = entityId;
    const logs = await AuditLog.find(filter).populate("user", "name").sort({ createdAt: -1 }).limit(take);
    return ok(logs);
  } catch (e) {
    return handleApiError(e);
  }
}
