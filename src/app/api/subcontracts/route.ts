import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Subcontract from "@/models/Subcontract";
import Project from "@/models/Project";
import Vendor from "@/models/Vendor";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const vendorId = searchParams.get("vendorId");

    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    if (vendorId) filter.vendorId = vendorId;

    await connectDB();
    const subcontracts = await Subcontract.find(filter)
      .populate("project", "id name status")
      .populate("vendor", "id name category contactPerson phone email")
      .populate("createdBy", "name")
      .sort({ createdAt: -1 });

    return ok(subcontracts);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();

    if (!data.projectId || !data.vendorId || !data.contractValue) {
      throw new ApiError(400, "projectId, vendorId, and contractValue are required");
    }

    const value = parseFloat(data.contractValue);
    if (isNaN(value) || value <= 0) {
      throw new ApiError(400, "contractValue must be a positive number");
    }

    await connectDB();

    // Verify Project exists
    const project = await Project.findById(data.projectId);
    if (!project) throw new ApiError(404, "Project not found");

    // If manager, check project boundary
    if (session.user.role === "manager" && project.assignedManagerId?.toString() !== session.user.id) {
      throw new ApiError(403, "You can only register subcontracts for your assigned projects");
    }

    // Verify Vendor exists and is active
    const vendor = await Vendor.findById(data.vendorId);
    if (!vendor) throw new ApiError(404, "Subcontractor (Vendor) not found");
    if (!vendor.isActive) throw new ApiError(400, "Subcontractor (Vendor) is deactivated");

    const subcontract = await Subcontract.create({
      projectId: toId(data.projectId),
      vendorId: toId(data.vendorId),
      contractValue: value,
      scopeOfWork: data.scopeOfWork || null,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      notes: data.notes || null,
      createdById: session.user.id,
    });

    await subcontract.populate("project", "name");
    await subcontract.populate("vendor", "name");
    await subcontract.populate("createdBy", "name");

    await auditLog(
      session.user.id,
      "CREATE",
      "Subcontract",
      subcontract.id,
      `Registered subcontract for vendor ${vendor.name} on project ${project.name} of value PKR ${value.toLocaleString()}`
    );

    return created(subcontract);
  } catch (e) {
    return handleApiError(e);
  }
}
