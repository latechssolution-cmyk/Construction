import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Task from "@/models/Task";
import Project from "@/models/Project";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const status = searchParams.get("status");

    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    if (status) filter.status = status;

    await connectDB();

    if (session.user.role === "manager") {
      const myProjects = await Project.find({ assignedManagerId: session.user.id }, { _id: 1 });
      const myProjectIds = myProjects.map((p) => p._id.toString());
      if (projectId && !myProjectIds.includes(projectId)) {
        return ok([]);
      }
      if (!projectId) filter.projectId = { $in: myProjects.map((p) => p._id) };
    }

    const tasks = await Task.find(filter)
      .populate("project", "id name")
      .populate("assignedTo", "id name")
      .populate("phase", "id name")
      .sort({ dueDate: 1 })
      .limit(500);
    return ok(tasks);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();
    if (!data.title || !data.projectId) throw new Error("Title and projectId are required");
    const est = data.estimatedHours ? parseFloat(data.estimatedHours) : null;
    if (est !== null && est < 0) throw new Error("Estimated hours cannot be negative");
    const weightVal = data.weight !== undefined ? parseFloat(data.weight) || 1 : 1;
    if (weightVal < 0) throw new Error("Task weight cannot be negative");

    await connectDB();
    const parsedHours = data.estimatedHours ? parseFloat(data.estimatedHours) : null;
    if (parsedHours !== null && parsedHours < 0) throw new ApiError(400, "Estimated hours cannot be negative");
    const parsedWeight = data.weight !== undefined ? parseFloat(data.weight) || 1 : 1;
    if (parsedWeight < 0) throw new ApiError(400, "Task weight cannot be negative");
    const task = await Task.create({
      title: data.title,
      description: data.description || null,
      status: data.status || "todo",
      priority: data.priority || "medium",
      projectId: toId(data.projectId),
      phaseId: toId(data.phaseId),
      assignedToId: toId(data.assignedToId),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: parsedHours,
      notes: data.notes || null,
      weight: parsedWeight,
    });
    await task.populate("project", "id name");
    await task.populate("assignedTo", "id name");

    const allTasks = await Task.find({ projectId: task.projectId }, { status: 1, weight: 1 });
    const totalWeight = allTasks.reduce((sum, t) => sum + (t.weight || 1), 0);
    const completedWeight = allTasks.filter(t => t.status === "completed").reduce((sum, t) => sum + (t.weight || 1), 0);
    const pct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
    await Project.findByIdAndUpdate(task.projectId, { completionPercent: pct });

    await auditLog(session.user.id, "CREATE", "Task", task.id, `Created task: ${task.title}`);
    return created(task);
  } catch (e) {
    return handleApiError(e);
  }
}
