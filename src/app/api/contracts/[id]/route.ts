import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Contract from "@/models/Contract";
import Project from "@/models/Project";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const contract = await Contract.findById(id).populate("client");
    if (!contract) throw new ApiError(404, "Contract not found");
    const projects = await Project.find({ contractId: id }).populate("assignedManager", "name");
    return ok({ ...contract.toJSON(), projects });
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
    const contract = await Contract.findById(id);
    if (!contract) throw new ApiError(404, "Contract not found");
    if (data.title !== undefined) contract.title = data.title;
    if (data.scope !== undefined) contract.scope = data.scope;
    if (data.contractValue !== undefined) { const parsedValue = parseFloat(data.contractValue); if (!isNaN(parsedValue)) contract.contractValue = parsedValue; }
    if (data.startDate !== undefined) contract.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) contract.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.status !== undefined) contract.status = data.status;
    if (data.paymentTerms !== undefined) contract.paymentTerms = data.paymentTerms;
    if (data.documentPath !== undefined) contract.documentPath = data.documentPath;
    if (data.notes !== undefined) contract.notes = data.notes;
    await contract.save();
    await auditLog(session.user.id, "UPDATE", "Contract", id, `Updated contract: ${contract.contractNumber}`);
    return ok(contract);
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
    await Contract.findByIdAndUpdate(id, { status: "terminated" });
    await auditLog(session.user.id, "DELETE", "Contract", id, "Terminated contract");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
