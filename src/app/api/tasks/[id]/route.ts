import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Task from "@/models/Task";
import Project from "@/models/Project";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const task = await Task.findById(id)
      .populate("project", "id name")
      .populate("assignedTo", "id name")
      .populate("phase", "id name");
    if (!task) throw new ApiError(404, "Task not found");
    return ok(task);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const isPrivileged = ["admin", "ceo", "manager"].includes(session.user.role);
    if (!isPrivileged) {
      const task = await Task.findById(id, { assignedToId: 1 });
      if (!task) throw new ApiError(404, "Task not found");
      if (task.assignedToId?.toString() !== session.user.id) throw new ApiError(403, "You can only update tasks assigned to you");
      const allowedKeys = ["status", "notes"];
      if (Object.keys(data).some((k) => !allowedKeys.includes(k))) throw new ApiError(403, "Insufficient permissions to modify task details");
    }

    const update: any = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.status !== undefined) update.status = data.status;
    if (data.priority !== undefined) update.priority = data.priority;
    if (data.assignedToId !== undefined) update.assignedToId = data.assignedToId;
    if (data.phaseId !== undefined) update.phaseId = data.phaseId;
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.estimatedHours !== undefined) update.estimatedHours = parseFloat(data.estimatedHours);
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.status === "completed") update.completedAt = new Date();

    const task = await Task.findByIdAndUpdate(id, update, { new: true }).populate("assignedTo", "name");
    if (!task) throw new ApiError(404, "Task not found");
    await auditLog(session.user.id, "UPDATE", "Task", id, `Updated task: ${task.title} → ${task.status}`);

    if (data.status !== undefined && task.projectId) {
      const allTasks = await Task.find({ projectId: task.projectId }, { status: 1 });
      const done = allTasks.filter((t) => t.status === "completed").length;
      const pct = allTasks.length > 0 ? Math.round((done / allTasks.length) * 100) : 0;
      await Project.findByIdAndUpdate(task.projectId, { completionPercent: pct });
    }
    return ok(task);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "manager");
    const { id } = await params;
    await connectDB();
    await Task.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "Task", id, "Deleted task");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
