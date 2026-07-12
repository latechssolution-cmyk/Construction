import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok } from "@/lib/api-helpers";
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

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") || "";
    const entityId = searchParams.get("entityId") || "";
    // Full audit log dump is admin/ceo only; entity-specific lookups (AuditTrail widget) are open to all authenticated users
    if (!entityId) requireRole(session, "admin", "ceo");
    else if (ADMIN_ONLY_MODULES.includes(entity)) requireRole(session, "admin", "ceo");
    else if (SENSITIVE_MODULES.includes(entity)) requireRole(session, "admin", "ceo", "accountant");
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
