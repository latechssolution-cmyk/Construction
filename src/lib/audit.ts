import { connectDB } from "@/lib/mongoose";
import AuditLog from "@/models/AuditLog";

export async function auditLog(
  userId: string | null | undefined,
  action: string,
  module: string,
  recordId?: string | null,
  details?: string | null,
  ipAddress?: string | null
) {
  try {
    await connectDB();

    let resolvedIp = ipAddress;
    if (!resolvedIp) {
      try {
        // Auto-resolve IP from headers inside Next.js request context (Issue #102)
        const { headers } = await import("next/headers");
        const headerList = await headers();
        resolvedIp =
          headerList.get("x-forwarded-for")?.split(",")[0].trim() ||
          headerList.get("x-real-ip") ||
          null;
      } catch {
        // Called outside request context (e.g. background job / seed script), ignore
      }
    }

    await AuditLog.create({
      userId: userId || undefined,
      action,
      module,
      recordId: recordId ?? undefined,
      details: details ?? undefined,
      ipAddress: resolvedIp ?? undefined,
    });
  } catch (err) {
    // Audit failures must never break the main flow
    console.error("[AuditLog] Failed to write:", { action, module, recordId }, err);
  }
}
