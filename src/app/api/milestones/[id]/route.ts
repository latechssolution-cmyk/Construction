import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const milestone = await Milestone.findById(id);
    if (!milestone) throw new ApiError(404, "Milestone not found");
    if (data.name !== undefined) milestone.name = data.name;
    if (data.description !== undefined) milestone.description = data.description || null;
    if (data.dueDate !== undefined) milestone.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.completed !== undefined) {
      milestone.completedAt = data.completed ? (milestone.completedAt ?? new Date()) : null;
    }
    await milestone.save();
    return ok(milestone);
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
    await Milestone.findByIdAndDelete(id);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
