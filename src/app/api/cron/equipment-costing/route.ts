import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { runEquipmentJobCosting } from "@/lib/equipment-job-costing";

async function runCron(req: NextRequest, body: any) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
  }
  const date = body?.date ? new Date(body.date) : new Date();
  const count = await runEquipmentJobCosting(date);
  return ok({ success: true, postedCount: count });
}

// Vercel Cron Jobs only issue GET requests (with an Authorization: Bearer
// $CRON_SECRET header it attaches automatically) — POST is kept for manual
// admin/ceo triggering from the UI or a curl call.
export async function GET(req: NextRequest) {
  try {
    return await runCron(req, {});
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => ({}));
    return await runCron(req, data);
  } catch (e) {
    return handleApiError(e);
  }
}
