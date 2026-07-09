import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import ProjectPhase from "@/models/ProjectPhase";
import Task from "@/models/Task";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const phase = await ProjectPhase.findById(id);
    if (!phase) throw new ApiError(404, "Phase not found");
    if (data.name !== undefined) phase.name = data.name;
    if (data.status !== undefined) phase.status = data.status;
    if (data.order !== undefined) { const parsedOrder = parseInt(data.order); if (!isNaN(parsedOrder)) phase.order = parsedOrder; }
    if (data.startDate !== undefined) phase.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) phase.endDate = data.endDate ? new Date(data.endDate) : null;
    await phase.save();
    void auditLog(session.user.id, "UPDATE", "ProjectPhase", id, `Updated phase: ${phase.name}`);
    return ok(phase);
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
    const phase = await ProjectPhase.findById(id);
    if (!phase) throw new ApiError(404, "Phase not found");
    // Unassign rather than delete the phase's tasks — the tasks are still
    // real work items, just no longer grouped under this phase.
    await Task.updateMany({ phaseId: id }, { phaseId: null });
    await ProjectPhase.findByIdAndDelete(id);
    void auditLog(session.user.id, "DELETE", "ProjectPhase", id, `Deleted phase: ${phase.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
