import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Equipment from "@/models/Equipment";
import ProjectEquipment from "@/models/ProjectEquipment";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    if (!data.projectId) throw new ApiError(400, "projectId is required");
    await connectDB();
    await ProjectEquipment.updateMany({ equipmentId: id, returnedAt: null }, { returnedAt: new Date() });
    const assignment = await ProjectEquipment.create({
      equipmentId: id,
      projectId: data.projectId,
      assignedAt: new Date(),
      notes: data.notes || null,
    });
    await Equipment.findByIdAndUpdate(id, { status: "in_use" });
    return created(assignment);
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
    await ProjectEquipment.updateMany({ equipmentId: id, returnedAt: null }, { returnedAt: new Date() });
    await Equipment.findByIdAndUpdate(id, { status: "available" });
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
