import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
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

    if (session.user.role === "manager" && !projectId) {
      const myProjects = await Project.find({ assignedManagerId: session.user.id }, { _id: 1 });
      filter.projectId = { $in: myProjects.map((p) => p._id) };
    }

    const tasks = await Task.find(filter)
      .populate("project", "id name")
      .populate("assignedTo", "id name")
      .populate("phase", "id name")
      .sort({ dueDate: 1 });
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
    await connectDB();
    const task = await Task.create({
      title: data.title,
      description: data.description || null,
      status: data.status || "todo",
      priority: data.priority || "medium",
      projectId: toId(data.projectId),
      phaseId: toId(data.phaseId),
      assignedToId: toId(data.assignedToId),
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: data.estimatedHours ? parseFloat(data.estimatedHours) : null,
      notes: data.notes || null,
    });
    await task.populate("project", "id name");
    await task.populate("assignedTo", "id name");
    await auditLog(session.user.id, "CREATE", "Task", task.id, `Created task: ${task.title}`);
    return created(task);
  } catch (e) {
    return handleApiError(e);
  }
}
