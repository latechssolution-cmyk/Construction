import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Contract from "@/models/Contract";
import Project from "@/models/Project";
import Invoice from "@/models/Invoice";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    const contract = await Contract.findById(id).populate("client").populate("variations");
    if (!contract) throw new ApiError(404, "Contract not found");
    const projects = await Project.find({ contractId: id }).populate("assignedManager", "name");
    if (session.user.role === "manager" && !projects.some((p: any) => p.assignedManagerId?.toString() === session.user.id)) {
      throw new ApiError(403, "You can only access contracts for your assigned projects");
    }
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
    if (session.user.role === "manager") {
      const ownsAny = await Project.exists({ contractId: id, assignedManagerId: session.user.id });
      if (!ownsAny) throw new ApiError(403, "You can only manage contracts for your assigned projects");
    }
    if (data.contractValue !== undefined && contract.status !== "draft") {
      throw new ApiError(400, "Base contract value is locked. Please log a Contract Variation Order to amend the contract value.");
    }
    if (data.title !== undefined) contract.title = data.title;
    if (data.scope !== undefined) contract.scope = data.scope;
    if (data.contractValue !== undefined && contract.status === "draft") {
      const parsedValue = parseFloat(data.contractValue);
      if (!isNaN(parsedValue)) {
        if (parsedValue < 0) throw new ApiError(400, "Contract value cannot be negative");
        contract.contractValue = parsedValue;
      }
    }
    if (data.startDate !== undefined) contract.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) contract.endDate = data.endDate ? new Date(data.endDate) : null;

    const start = contract.startDate;
    const end = contract.endDate;
    if (start && end && end < start) {
      throw new ApiError(400, "End date cannot be before start date");
    }
    // Issue #67: Strict contract status transition machine
    if (data.status !== undefined) {
      const CONTRACT_TRANSITIONS: Record<string, string[]> = {
        draft: ["active", "cancelled"],
        active: ["on_hold", "completed", "terminated"],
        on_hold: ["active", "terminated"],
        completed: [], // Terminal — no transitions allowed
        terminated: [], // Terminal — no transitions allowed
        cancelled: [], // Terminal — no transitions allowed
      };
      const currentStatus = contract.status || "draft";
      if (data.status !== currentStatus) {
        const allowed = CONTRACT_TRANSITIONS[currentStatus] || [];
        if (!allowed.includes(data.status)) {
          throw new ApiError(400, `Cannot transition contract from '${currentStatus}' to '${data.status}'. Allowed transitions: [${allowed.join(", ") || "none — this is a terminal state"}]`);
        }
      }
      contract.status = data.status;
      if (["terminated", "cancelled"].includes(data.status)) {
        await Project.updateMany({ contractId: id }, { status: "on_hold" });
      }
    }
    if (data.paymentTerms !== undefined) contract.paymentTerms = data.paymentTerms;
    if (data.documentPath !== undefined) contract.documentPath = data.documentPath;
    if (data.notes !== undefined) contract.notes = data.notes;
    await contract.save();
    void auditLog(session.user.id, "UPDATE", "Contract", id, `Updated contract: ${contract.contractNumber}`);
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
    const contract = await Contract.findById(id);
    if (!contract) throw new ApiError(404, "Contract not found");
    if (["completed", "terminated", "cancelled"].includes(contract.status)) {
      throw new ApiError(400, `Contract is already in terminal state '${contract.status}'`);
    }
    // Issue #68: Block termination when open invoices exist
    const linkedProjects = await Project.find({ contractId: id }, { _id: 1 }).lean();
    if (linkedProjects.length > 0) {
      const projectIds = linkedProjects.map((p: any) => p._id);
      const openInvoiceCount = await Invoice.countDocuments({
        projectId: { $in: projectIds },
        status: { $in: ["draft", "sent", "overdue", "partially_paid"] },
        deletedAt: null,
      });
      if (openInvoiceCount > 0) {
        throw new ApiError(400, `Cannot terminate contract: ${openInvoiceCount} open invoice(s) are linked to projects under this contract. Resolve all invoices first.`);
      }
    }
    await Contract.findByIdAndUpdate(id, { status: "terminated" });
    await Project.updateMany({ contractId: id }, { status: "on_hold" });
    void auditLog(session.user.id, "DELETE", "Contract", id, "Terminated contract");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
