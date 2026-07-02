import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import { auditLog } from "@/lib/audit";
import Attendance from "@/models/Attendance";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const existing = await Attendance.findById(id);
    if (!existing) throw new ApiError(404, "Attendance record not found");
    if (data.status !== undefined) existing.status = data.status;
    if (data.hoursWorked !== undefined) {
      const val = Math.max(0, Number(data.hoursWorked) || 0);
      if (val > 24) throw new ApiError(400, "Hours worked cannot exceed 24 hours in a single day.");
      existing.hoursWorked = val;
    }
    if (data.notes !== undefined) existing.notes = data.notes?.trim() ? data.notes.trim() : null;
    if (data.date !== undefined) existing.date = new Date(data.date);
    await existing.save();
    await existing.populate("employee", "id name");
    await auditLog(session.user.id, "UPDATE", "Attendance", id, `Updated attendance record for employee: ${(existing as any).employee?.name || existing.employeeId}`);
    return ok(existing);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    await connectDB();
    const existing = await Attendance.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "Attendance", id, `Deleted attendance record for employee ID: ${existing?.employeeId}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
