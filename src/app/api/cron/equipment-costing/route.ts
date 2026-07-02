import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { runEquipmentJobCosting } from "@/lib/equipment-job-costing";

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const data = await req.json().catch(() => ({}));
    const date = data.date ? new Date(data.date) : new Date();
    const count = await runEquipmentJobCosting(date);
    return ok({ success: true, postedCount: count });
  } catch (e) {
    return handleApiError(e);
  }
}
