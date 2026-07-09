import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Equipment from "@/models/Equipment";
import ProjectEquipment from "@/models/ProjectEquipment";
import EquipmentMaintenance from "@/models/EquipmentMaintenance";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const eq = await Equipment.findById(id);
    if (!eq) throw new ApiError(404, "Equipment not found");
    const [assignments, maintenance] = await Promise.all([
      ProjectEquipment.find({ equipmentId: id }).populate("project", "id name").sort({ assignedAt: -1 }),
      EquipmentMaintenance.find({ equipmentId: id }).sort({ date: -1 }),
    ]);
    return ok({ ...eq.toJSON(), assignments, maintenance });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const eq = await Equipment.findById(id);
    if (!eq) throw new ApiError(404, "Equipment not found");
    const fields = ["name","type","model","condition","status","location","notes","dailyRate","hourlyRate"] as const;
    if (data.status !== undefined && data.status !== eq.status) {
      if (data.status === "available") {
        const activeAssign = await ProjectEquipment.findOne({ equipmentId: id, returnedAt: null }).populate("project", "name");
        if (activeAssign) {
          throw new ApiError(400, `Cannot change status to available. This equipment is currently assigned to project "${((activeAssign as any).project)?.name || activeAssign.projectId}". Please return it first.`);
        }
      } else if (data.status === "in_use") {
        const activeAssign = await ProjectEquipment.findOne({ equipmentId: id, returnedAt: null });
        if (!activeAssign) {
          throw new ApiError(400, "Cannot set status to in_use directly without a project assignment. Please use the assignment interface.");
        }
      }
    }
    fields.forEach((f) => { if (data[f] !== undefined) (eq as any)[f] = data[f]; });
    if (data.dailyRate !== undefined && parseFloat(data.dailyRate) < 0) throw new ApiError(400, "Daily rate cannot be negative");
    if (data.hourlyRate !== undefined && parseFloat(data.hourlyRate) < 0) throw new ApiError(400, "Hourly rate cannot be negative");
    await eq.save();
    await auditLog(session.user.id, "UPDATE", "Equipment", id, `Updated: ${eq.name}`);
    return ok(eq);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin");
    const { id } = await params;
    await connectDB();
    
    // Decommission equipment and close any active project assignments
    const eq = await Equipment.findByIdAndUpdate(id, { status: "decommissioned" }, { new: true });
    await ProjectEquipment.updateMany({ equipmentId: id, returnedAt: null }, { returnedAt: new Date() });
    
    await auditLog(session.user.id, "DELETE", "Equipment", id, `Decommissioned: ${eq?.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
