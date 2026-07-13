import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Contract from "@/models/Contract";
import ContractVariation from "@/models/ContractVariation";
import Project from "@/models/Project";

function generateVariationNumber(contractNum: string) {
  const now = new Date();
  return `VAR-${contractNum}-${Math.floor(Math.random() * 900 + 100)}`;
}

async function assertManagerOwnsContract(session: { user: { id: string; role: string } }, contractId: string) {
  if (session.user.role !== "manager") return;
  const ownsAny = await Project.exists({ contractId, assignedManagerId: session.user.id });
  if (!ownsAny) throw new ApiError(403, "You can only manage variations for your assigned projects' contracts");
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    await assertManagerOwnsContract(session, id);
    const variations = await ContractVariation.find({ contractId: id }).sort({ createdAt: -1 });
    return ok(variations);
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
    if (!data.title) throw new ApiError(400, "Title is required");
    await connectDB();
    await assertManagerOwnsContract(session, id);

    const contract = await Contract.findById(id);
    if (!contract) throw new ApiError(404, "Contract not found");

    const varNum = data.variationNumber || generateVariationNumber(contract.contractNumber);
    const valueChange = parseFloat(data.valueChange || "0") || 0;

    // Approval is a separate, admin/ceo-only action via PUT — a manager
    // (who can create variations) must not be able to set status:"approved"
    // here and skip that gate. Only admin/ceo may create pre-approved.
    const canApprove = ["admin", "ceo"].includes(session.user.role);
    const status = data.status === "approved" && canApprove ? "approved" : "pending";

    const variation = await ContractVariation.create({
      contractId: id,
      variationNumber: varNum,
      title: data.title,
      description: data.description || null,
      valueChange,
      status,
      approvedById: status === "approved" ? session.user.id : null,
      notes: data.notes || null,
    });

    void auditLog(session.user.id, "CREATE", "ContractVariation", variation.id, `Created contract variation: ${varNum} (${valueChange})`);
    return created(variation);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    const data = await req.json();
    const { variationId, status, notes } = data;
    if (!variationId || !status) throw new ApiError(400, "variationId and status are required");
    if (!["pending", "approved", "rejected"].includes(status)) throw new ApiError(400, "Invalid status");

    await connectDB();
    const variation = await ContractVariation.findOne({ _id: variationId, contractId: id });
    if (!variation) throw new ApiError(404, "Contract variation not found");

    variation.status = status;
    if (status === "approved") {
      variation.approvedById = session.user.id as any;
    } else {
      variation.approvedById = undefined;
    }
    if (notes !== undefined) variation.notes = notes;
    await variation.save();

    void auditLog(session.user.id, "UPDATE", "ContractVariation", variation.id, `Updated variation status to ${status}: ${variation.variationNumber}`);
    return ok(variation);
  } catch (e) {
    return handleApiError(e);
  }
}
