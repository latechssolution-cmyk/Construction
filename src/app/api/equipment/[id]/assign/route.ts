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
    const eq = await Equipment.findById(id);
    if (!eq) throw new ApiError(404, "Equipment not found");
    if (eq.status === "maintenance" || eq.status === "decommissioned") {
      throw new ApiError(400, `Cannot assign equipment. Machinery status is currently "${eq.status}".`);
    }
    await ProjectEquipment.updateMany({ equipmentId: id, returnedAt: null }, { returnedAt: new Date() });
    const assignment = await ProjectEquipment.create({
      equipmentId: id,
      projectId: data.projectId,
      assignedAt: new Date(),
      notes: data.notes || null,
    });
    await Equipment.findByIdAndUpdate(id, { status: "in_use" });
    await auditLog(session.user.id, "CREATE", "ProjectEquipment", assignment.id, `Assigned machinery "${eq.name}" to project ID: ${data.projectId}`);
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
