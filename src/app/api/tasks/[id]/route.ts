import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
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

// Managers may only touch tasks that live inside a project assigned to them —
// admins/ceo can touch any task, everyone else can only update their own
// assigned tasks (status/notes) via the branch below.
async function assertManagerOwnsTask(session: { user: { id: string; role: string } }, task: { projectId?: any }) {
  if (session.user.role !== "manager" || !task.projectId) return;
  const project = await Project.findById(task.projectId, { assignedManagerId: 1 });
  if (project?.assignedManagerId?.toString() !== session.user.id) {
    throw new ApiError(403, "You can only manage tasks in your assigned projects");
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = await req.json();
    await connectDB();

    const taskExist = await Task.findById(id);
    if (!taskExist) throw new ApiError(404, "Task not found");

    if (session.user.role === "manager") {
      const project = await Project.findById(taskExist.projectId, { assignedManagerId: 1 });
      if (project && project.assignedManagerId?.toString() !== session.user.id) {
        throw new ApiError(403, "You can only manage tasks on your assigned projects");
      }
    } else if (!["admin", "ceo"].includes(session.user.role)) {
      if (taskExist.assignedToId?.toString() !== session.user.id) throw new ApiError(403, "You can only update tasks assigned to you");
      const allowedKeys = ["status", "notes"];
      if (Object.keys(data).some((k) => !allowedKeys.includes(k))) throw new ApiError(403, "Insufficient permissions to modify task details");
    }
    // admin/ceo: no additional ownership check — they can manage any task.

    const update: any = {};
    if (data.title !== undefined) update.title = data.title;
    if (data.description !== undefined) update.description = data.description;
    if (data.status !== undefined) update.status = data.status;
    if (data.priority !== undefined) update.priority = data.priority;
    if (data.assignedToId !== undefined) update.assignedToId = toId(data.assignedToId);
    if (data.phaseId !== undefined) update.phaseId = toId(data.phaseId);
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    if (data.estimatedHours !== undefined) { const parsedHours = parseFloat(data.estimatedHours); if (!isNaN(parsedHours)) { if (parsedHours < 0) throw new ApiError(400, "Estimated hours cannot be negative"); update.estimatedHours = parsedHours; } }
    if (data.notes !== undefined) update.notes = data.notes;
    if (data.weight !== undefined) { const parsedWeight = parseFloat(data.weight); if (!isNaN(parsedWeight)) { if (parsedWeight < 0) throw new ApiError(400, "Task weight cannot be negative"); update.weight = parsedWeight; } }
    if (data.status === "completed") update.completedAt = new Date();
    else if (data.status !== undefined) update.completedAt = null;

    const task = await Task.findByIdAndUpdate(id, update, { new: true }).populate("assignedTo", "name");
    if (!task) throw new ApiError(404, "Task not found");
    void auditLog(session.user.id, "UPDATE", "Task", id, `Updated task: ${task.title} → ${task.status}`);

    // Project.completionPercent is intentionally NOT recomputed here — it's
    // a manually-tracked figure the project owner adjusts directly (see the
    // slider on the project detail page). Task-based progress is already
    // surfaced separately as "taskProgress" via /api/projects/[id]/summary;
    // overwriting completionPercent from it here silently clobbered manual
    // updates every time any task's status changed.
    return ok(task);
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
    const existingTask = await Task.findById(id, { projectId: 1 });
    if (!existingTask) throw new ApiError(404, "Task not found");
    await assertManagerOwnsTask(session, existingTask);
    const task = await Task.findByIdAndDelete(id);
    void auditLog(session.user.id, "DELETE", "Task", id, "Deleted task");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
