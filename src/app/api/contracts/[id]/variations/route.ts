import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Contract from "@/models/Contract";
import ContractVariation from "@/models/ContractVariation";

function generateVariationNumber(contractNum: string) {
  const now = new Date();
  return `VAR-${contractNum}-${Math.floor(Math.random() * 900 + 100)}`;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
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

    const contract = await Contract.findById(id);
    if (!contract) throw new ApiError(404, "Contract not found");

    const varNum = data.variationNumber || generateVariationNumber(contract.contractNumber);
    const valueChange = parseFloat(data.valueChange || "0") || 0;

    const variation = await ContractVariation.create({
      contractId: id,
      variationNumber: varNum,
      title: data.title,
      description: data.description || null,
      valueChange,
      status: data.status || "pending",
      approvedById: data.status === "approved" ? session.user.id : null,
      notes: data.notes || null,
    });

    await auditLog(session.user.id, "CREATE", "ContractVariation", variation.id, `Created contract variation: ${varNum} (${valueChange})`);
    return created(variation);
  } catch (e) {
    return handleApiError(e);
  }
}
