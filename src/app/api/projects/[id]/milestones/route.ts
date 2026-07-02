import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, assertManagerOwnsProject } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Milestone from "@/models/Milestone";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    assertManagerOwnsProject(session, await Project.findById(id, { assignedManagerId: 1 }));
    const milestones = await Milestone.find({ projectId: id }).sort({ dueDate: 1 });
    return ok(milestones);
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
    if (!data.name) throw new Error("Milestone name is required");
    await connectDB();
    assertManagerOwnsProject(session, await Project.findById(id, { assignedManagerId: 1 }));
    const milestone = await Milestone.create({
      projectId: id,
      name: data.name,
      description: data.description?.trim() || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    });
    void auditLog(session.user.id, "CREATE", "Milestone", milestone.id, `Created milestone: ${milestone.name}`);
    return created(milestone);
  } catch (e) {
    return handleApiError(e);
  }
}
