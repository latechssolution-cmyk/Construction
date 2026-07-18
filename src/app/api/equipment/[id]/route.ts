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
    if (data.type !== undefined && !data.type) {
      throw new ApiError(400, "Type is required");
    }
    if (data.purchasePrice !== undefined && data.purchasePrice !== null && data.purchasePrice !== "") {
      const parsedPPrice = parseFloat(data.purchasePrice);
      if (!isNaN(parsedPPrice) && parsedPPrice < 0) {
        throw new ApiError(400, "Purchase price cannot be negative");
      }
    }
    if (data.dailyRate !== undefined) {
      const parsedDRate = parseFloat(data.dailyRate);
      if (!isNaN(parsedDRate) && parsedDRate < 0) {
        throw new ApiError(400, "Daily rate cannot be negative");
      }
    }
    if (data.hourlyRate !== undefined) {
      const parsedHRate = parseFloat(data.hourlyRate);
      if (!isNaN(parsedHRate) && parsedHRate < 0) {
        throw new ApiError(400, "Hourly rate cannot be negative");
      }
    }

    const fields = ["name","type","model","condition","status","location","notes","dailyRate","hourlyRate","purchasePrice","purchaseDate"] as const;
    fields.forEach((f) => {
      if (data[f] !== undefined) {
        if (f === "purchasePrice") {
          (eq as any)[f] = data[f] === "" || data[f] === null ? null : parseFloat(data[f]);
        } else if (f === "purchaseDate") {
          (eq as any)[f] = data[f] === "" || data[f] === null ? null : new Date(data[f]);
        } else if (f === "dailyRate" || f === "hourlyRate") {
          (eq as any)[f] = parseFloat(data[f]) || 0;
        } else {
          (eq as any)[f] = data[f];
        }
      }
    });
    await eq.save();
    void auditLog(session.user.id, "UPDATE", "Equipment", id, `Updated: ${eq.name}`);
    return ok(eq);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    await connectDB();
    
    // Decommission equipment and close any active project assignments
    const eq = await Equipment.findByIdAndUpdate(id, { status: "decommissioned" }, { new: true });
    await ProjectEquipment.updateMany({ equipmentId: id, returnedAt: null }, { returnedAt: new Date() });
    
    void auditLog(session.user.id, "DELETE", "Equipment", id, `Decommissioned: ${eq?.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
