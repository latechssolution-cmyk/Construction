import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import { auditLog } from "@/lib/audit";
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
    const equipment = await Equipment.findById(id, { status: 1, name: 1 });
    if (!equipment) throw new ApiError(404, "Equipment not found");
    if (equipment.status === "decommissioned") throw new ApiError(400, `${equipment.name} is decommissioned and cannot be assigned to a project`);
    if (equipment.status === "maintenance") throw new ApiError(400, `${equipment.name} is under maintenance and cannot be assigned to a project until it's marked available`);
    await ProjectEquipment.updateMany({ equipmentId: id, returnedAt: null }, { returnedAt: new Date() });
    const assignment = await ProjectEquipment.create({
      equipmentId: id,
      projectId: data.projectId,
      assignedAt: new Date(),
      notes: data.notes || null,
    });
    await Equipment.findByIdAndUpdate(id, { status: "in_use" });
    await auditLog(session.user.id, "CREATE", "ProjectEquipment", assignment.id, `Assigned machinery "${equipment.name}" to project ID: ${data.projectId}`);
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
    const eq = await Equipment.findByIdAndUpdate(id, { status: "available" }, { new: true });
    await auditLog(session.user.id, "DELETE", "ProjectEquipment", id, `Returned machinery "${eq?.name || id}" to available pool`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
