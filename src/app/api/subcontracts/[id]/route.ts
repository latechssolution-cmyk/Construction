import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Subcontract from "@/models/Subcontract";
import Project from "@/models/Project";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const subcontract = await Subcontract.findById(id)
      .populate("project", "id name status")
      .populate("vendor", "id name category contactPerson phone email")
      .populate("createdBy", "name");
    if (!subcontract) throw new ApiError(404, "Subcontract not found");
    return ok(subcontract);
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

    const subcontract = await Subcontract.findById(id);
    if (!subcontract) throw new ApiError(404, "Subcontract not found");

    // If manager, check project boundary
    if (session.user.role === "manager") {
      const project = await Project.findById(subcontract.projectId, { assignedManagerId: 1 });
      if (project && project.assignedManagerId?.toString() !== session.user.id) {
        throw new ApiError(403, "You can only manage subcontracts for your assigned projects");
      }
    }

    const fields = ["scopeOfWork", "notes"] as const;
    fields.forEach((f) => { if (data[f] !== undefined) (subcontract as any)[f] = data[f]; });

    if (data.contractValue !== undefined) {
      const value = parseFloat(data.contractValue);
      if (isNaN(value) || value <= 0) throw new ApiError(400, "contractValue must be a positive number");
      subcontract.contractValue = value;
    }

    if (data.startDate !== undefined) subcontract.startDate = data.startDate ? new Date(data.startDate) : undefined;
    if (data.endDate !== undefined) subcontract.endDate = data.endDate ? new Date(data.endDate) : undefined;

    await subcontract.save();
    void auditLog(session.user.id, "UPDATE", "Subcontract", id, `Updated subcontract details`);
    return ok(subcontract);
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

    const subcontract = await Subcontract.findById(id);
    if (!subcontract) throw new ApiError(404, "Subcontract not found");

    // If manager, check project boundary
    if (session.user.role === "manager") {
      const project = await Project.findById(subcontract.projectId, { assignedManagerId: 1 });
      if (project && project.assignedManagerId?.toString() !== session.user.id) {
        throw new ApiError(403, "You can only manage subcontracts for your assigned projects");
      }
    }

    await Subcontract.findByIdAndDelete(id);
    void auditLog(session.user.id, "DELETE", "Subcontract", id, `Deleted subcontract`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
