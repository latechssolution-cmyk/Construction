import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import ProjectPhase from "@/models/ProjectPhase";
import Task from "@/models/Task";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
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
    const count = await ProjectPhase.countDocuments({ projectId: id });
    const phase = await ProjectPhase.create({ projectId: id, name: data.name, order: count });
    return created(phase);
  } catch (e) {
    return handleApiError(e);
  }
}
