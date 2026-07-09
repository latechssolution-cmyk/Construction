import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
import { runEquipmentJobCosting } from "@/lib/equipment-job-costing";
import { sweepOverdueInvoices } from "@/lib/invoice-overdue";

// Single daily entry point for backend jobs that don't need user
// intervention: posting equipment usage costs to the ledger, and flipping
// invoices past their due date to "overdue" so stats/lists stay accurate
// without anyone opening the app. Vercel Cron calls this once a day (see
// vercel.json); it can also be triggered manually by an admin/ceo.
async function runDailyJobs(req: NextRequest, body: any) {
  const authHeader = req.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
  }
  const date = body?.date ? new Date(body.date) : new Date();
  const [equipmentCostingCount, overdueInvoiceCount] = await Promise.all([
    runEquipmentJobCosting(date),
    sweepOverdueInvoices(date),
  ]);
  return ok({ success: true, equipmentCostingCount, overdueInvoiceCount });
}

export async function GET(req: NextRequest) {
  try {
    return await runDailyJobs(req, {});
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json().catch(() => ({}));
    return await runDailyJobs(req, data);
  } catch (e) {
    return handleApiError(e);
  }
}
