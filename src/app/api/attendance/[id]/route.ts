import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
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
    if (data.hoursWorked !== undefined) existing.hoursWorked = Math.max(0, Number(data.hoursWorked) || 0);
    if (data.notes !== undefined) existing.notes = data.notes?.trim() ? data.notes.trim() : null;
    if (data.date !== undefined) existing.date = new Date(data.date);
    await existing.save();
    await existing.populate("employee", "id name");
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
    await Attendance.findByIdAndDelete(id);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
