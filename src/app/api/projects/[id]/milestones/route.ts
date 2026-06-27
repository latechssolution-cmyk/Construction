import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Milestone from "@/models/Milestone";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
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
    const milestone = await Milestone.create({
      projectId: id,
      name: data.name,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
    });
    return created(milestone);
  } catch (e) {
    return handleApiError(e);
  }
}
