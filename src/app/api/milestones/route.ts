import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const filter: any = {};
    if (projectId) filter.projectId = toId(projectId);

    await connectDB();
    const milestones = await Milestone.find(filter)
      .populate("project", "name status")
      .sort({ dueDate: 1 })
      .limit(500)
      .lean();
      
    return ok(milestones.map((m: any) => ({ ...m, id: m._id?.toString() || m.id })));
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();
    if (!data.name || !data.projectId) {
      throw new Error("Name and Project are required");
    }
    await connectDB();
    
    const projId = toId(data.projectId);
    const project = await Project.findById(projId);
    if (!project) throw new Error("Project not found");

    const milestone = await Milestone.create({
      projectId: projId,
      name: data.name,
      description: data.description || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      completedAt: data.completed ? new Date() : null,
    });

    await auditLog(session.user.id, "CREATE", "Milestone", milestone.id, `Created milestone ${milestone.name}`);
    return created(milestone);
  } catch (e) {
    return handleApiError(e);
  }
}
