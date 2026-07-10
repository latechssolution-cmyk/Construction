import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, assertManagerOwnsProject } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import ProjectPhase from "@/models/ProjectPhase";
import Task from "@/models/Task";
import Project from "@/models/Project";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { phaseId } = await params;
    const data = await req.json();
    await connectDB();

    const phase = await ProjectPhase.findById(phaseId);
    if (!phase) throw new ApiError(404, "Project phase not found");
    if (session.user.role === "manager") {
      const project = await Project.findById(phase.projectId, { assignedManagerId: 1 });
      assertManagerOwnsProject(session, project);
    }

    if (data.name !== undefined) phase.name = data.name;
    if (data.status !== undefined) phase.status = data.status;
    if (data.order !== undefined) phase.order = Number(data.order) || 0;
    if (data.startDate !== undefined) phase.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) phase.endDate = data.endDate ? new Date(data.endDate) : null;

    await phase.save();
    return ok(phase);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { phaseId } = await params;
    await connectDB();

    const phase = await ProjectPhase.findById(phaseId);
    if (!phase) throw new ApiError(404, "Project phase not found");
    if (session.user.role === "manager") {
      const project = await Project.findById(phase.projectId, { assignedManagerId: 1 });
      assertManagerOwnsProject(session, project);
    }

    // Nullify phaseId on tasks that belong to this phase
    await Task.updateMany({ phaseId }, { $set: { phaseId: null } });

    await ProjectPhase.findByIdAndDelete(phaseId);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
