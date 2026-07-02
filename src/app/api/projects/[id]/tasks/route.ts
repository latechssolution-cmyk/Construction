import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, assertManagerOwnsProject } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Task from "@/models/Task";
import Project from "@/models/Project";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    assertManagerOwnsProject(session, await Project.findById(id, { assignedManagerId: 1 }));
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
    assertManagerOwnsProject(session, await Project.findById(id, { assignedManagerId: 1 }));
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
      weight: data.weight !== undefined ? parseFloat(data.weight) || 1 : 1,
    });
    await task.populate("assignedTo", "id name");

    const allTasks = await Task.find({ projectId: id }, { status: 1, weight: 1 });
    const totalWeight = allTasks.reduce((sum, t) => sum + (t.weight || 1), 0);
    const completedWeight = allTasks.filter(t => t.status === "completed").reduce((sum, t) => sum + (t.weight || 1), 0);
    const pct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    await Project.findByIdAndUpdate(id, { completionPercent: pct });

    await auditLog(session.user.id, "CREATE", "Task", task.id, `Created task: ${task.title}`);
    return created(task);
  } catch (e) {
    return handleApiError(e);
  }
}
