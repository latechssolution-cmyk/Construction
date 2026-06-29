import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Task from "@/models/Task";
import Project from "@/models/Project";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const tasks = await Task.find({ projectId: id })
      .populate("assignedTo", "id name")
      .populate("phase", "id name")
      .sort({ status: 1, dueDate: 1 });
    return ok(tasks);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    if (!data.title) throw new Error("Task title is required");
    await connectDB();
    if (!await Project.exists({ _id: id })) throw new ApiError(404, "Project not found");
    const task = await Task.create({
      title: data.title,
      description: data.description || null,
      status: data.status || "todo",
      priority: data.priority || "medium",
      projectId: id,
      phaseId: data.phaseId || null,
      assignedToId: data.assignedToId || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
    });
    await task.populate("assignedTo", "id name");
    await auditLog(session.user.id, "CREATE", "Task", task.id, `Created task: ${task.title}`);
    return created(task);
  } catch (e) {
    return handleApiError(e);
  }
}
