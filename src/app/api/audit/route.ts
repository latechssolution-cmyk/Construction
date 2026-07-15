import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, toId } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import AuditLog from "@/models/AuditLog";

// Modules whose audit trail contains financial details (amounts, salary,
// account balances) — these must stay finance-role-only even for
// entity-specific lookups, unlike e.g. a Task or Project audit trail.
const SENSITIVE_MODULES = ["LedgerEntry", "Salary", "BankAccount", "Payment", "Invoice"];
// Account-security audit trail (password resets, role/activation changes) —
// this is an admin/ceo concern regardless of entity-specific lookup, not
// something a manager or accountant should be able to pull for any user.
const ADMIN_ONLY_MODULES = ["User", "Employee"];

const VALID_ACTIONS = ["CREATE", "UPDATE", "DELETE"];

// Escape user input before embedding it in a $regex search.
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") || "";
    const entityId = searchParams.get("entityId") || "";

    await connectDB();

    // Entity-specific lookups back the AuditTrail widget ("last updated by…")
    // and keep their original plain-array response shape.
    if (entityId) {
      if (ADMIN_ONLY_MODULES.includes(entity)) requireRole(session, "admin", "ceo");
      else if (SENSITIVE_MODULES.includes(entity)) requireRole(session, "admin", "ceo", "accountant");
      const take = Math.min(200, Math.max(1, parseInt(searchParams.get("take") || "50")));
      const filter: any = { recordId: entityId };
      if (entity) filter.module = entity;
      const logs = await AuditLog.find(filter).populate("user", "name").sort({ createdAt: -1 }).limit(take);
      return ok(logs);
    }

    // Full audit log browser — admin/ceo only.
    requireRole(session, "admin", "ceo");

    const filter: any = {};
    if (entity) filter.module = entity;
    const action = searchParams.get("action") || "";
    if (VALID_ACTIONS.includes(action)) filter.action = action;
    const userId = toId(searchParams.get("userId"));
    if (userId) filter.userId = userId;
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    const q = (searchParams.get("q") || "").trim();
    if (q) filter.details = { $regex: escapeRegex(q), $options: "i" };

    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));

    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart); weekStart.setDate(weekStart.getDate() - 6);

    const [logs, total, todayCount, weekCount, modules, grandTotal] = await Promise.all([
      AuditLog.find(filter)
        .populate("user", "name role")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      AuditLog.countDocuments(filter),
      AuditLog.countDocuments({ createdAt: { $gte: todayStart } }),
      AuditLog.countDocuments({ createdAt: { $gte: weekStart } }),
      // Distinct module list drives the filter dropdown — always the full
      // set, regardless of active filters, so options don't vanish as you
      // narrow down.
      AuditLog.distinct("module"),
      AuditLog.estimatedDocumentCount(),
    ]);

    return ok({
      logs,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      stats: { total: grandTotal, today: todayCount, week: weekCount },
      modules: (modules as string[]).sort(),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
