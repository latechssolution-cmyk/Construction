import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import { auditLog } from "@/lib/audit";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const milestone = await Milestone.findById(id);
    if (!milestone) throw new ApiError(404, "Milestone not found");
    if (session.user.role === "manager") {
      const project = await Project.findById(milestone.projectId, { assignedManagerId: 1 });
      if (project && project.assignedManagerId?.toString() !== session.user.id) {
        throw new ApiError(403, "You can only manage milestones on your assigned projects");
      }
    }
    if (data.name !== undefined) milestone.name = data.name;
    if (data.description !== undefined) milestone.description = data.description || null;
    if (data.dueDate !== undefined) milestone.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.completed !== undefined) {
      milestone.completedAt = data.completed ? (milestone.completedAt ?? new Date()) : null;
    }
    await milestone.save();
    await auditLog(session.user.id, "UPDATE", "Milestone", id, `Updated milestone: ${milestone.name}`);
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
    const milestone = await Milestone.findById(id);
    if (!milestone) throw new ApiError(404, "Milestone not found");
    if (session.user.role === "manager") {
      const project = await Project.findById(milestone.projectId, { assignedManagerId: 1 });
      if (project && project.assignedManagerId?.toString() !== session.user.id) {
        throw new ApiError(403, "You can only manage milestones on your assigned projects");
      }
    }
    await Milestone.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "Milestone", id, `Deleted milestone: ${milestone.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
