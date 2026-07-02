import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, assertManagerOwnsProject } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import ProjectPhase from "@/models/ProjectPhase";
import Task from "@/models/Task";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    assertManagerOwnsProject(session, await Project.findById(id, { assignedManagerId: 1 }));
    const phases = await ProjectPhase.find({ projectId: id }).sort({ order: 1 });
    const phaseIds = phases.map((p) => p._id);
    const tasks = await Task.find({ phaseId: { $in: phaseIds } }).populate("assignedTo", "id name").sort({ createdAt: 1 });
    const taskMap: Record<string, any[]> = {};
    tasks.forEach((t) => {
      const key = t.phaseId?.toString() || "";
      if (!taskMap[key]) taskMap[key] = [];
      taskMap[key].push(t.toJSON());
    });
    const result = phases.map((ph) => ({ ...ph.toJSON(), tasks: taskMap[ph.id] || [] }));
    return ok(result);
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
    if (!data.name) throw new Error("Phase name is required");
    await connectDB();
    assertManagerOwnsProject(session, await Project.findById(id, { assignedManagerId: 1 }));
    const count = await ProjectPhase.countDocuments({ projectId: id });
    const phase = await ProjectPhase.create({ projectId: id, name: data.name, order: count });
    void auditLog(session.user.id, "CREATE", "ProjectPhase", phase.id, `Created phase: ${phase.name}`);
    return created(phase);
  } catch (e) {
    return handleApiError(e);
  }
}
