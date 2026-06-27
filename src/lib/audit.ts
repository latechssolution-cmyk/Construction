import { connectDB } from "@/lib/mongoose";
import AuditLog from "@/models/AuditLog";

export async function auditLog(
  userId: string | null | undefined,
  action: string,
  module: string,
  recordId?: string | null,
  details?: string | null
) {
  try {
    await connectDB();
    await AuditLog.create({
      userId: userId || undefined,
      action,
      module,
      recordId: recordId ?? undefined,
      details: details ?? undefined,
    });
  } catch {
    // Audit failures must never break the main flow
    console.error("[AuditLog] Failed to write:", { action, module, recordId });
  }
}
