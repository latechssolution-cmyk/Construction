import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Contract from "@/models/Contract";
import Project from "@/models/Project";

function generateContractNumber() {
  const now = new Date();
  return `CON-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Math.floor(Math.random() * 9000 + 1000)}`;
}

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const contracts = await Contract.find({}).populate("client", "id name").sort({ createdAt: -1 }).limit(500);
    const contractIds = contracts.map((c) => c._id);
    const projects = await Project.find({ contractId: { $in: contractIds } }, { name: 1, status: 1, contractId: 1 });
    const result = contracts.map((c) => {
      const obj = c.toJSON() as any;
      obj.projects = projects.filter((p) => p.contractId?.toString() === c.id).map((p) => p.toJSON());
      return obj;
    });
    return ok(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();
    if (!data.title || !data.clientId) throw new Error("Title and client are required");
    await connectDB();
    const contract = await Contract.create({
      contractNumber: data.contractNumber || generateContractNumber(),
      title: data.title,
      scope: data.scope || null,
      contractValue: parseFloat(data.contractValue || data.value || "0"),
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      status: data.status || "active",
      clientId: toId(data.clientId),
      paymentTerms: data.paymentTerms || null,
      documentPath: data.documentPath || null,
      notes: data.notes || null,
    });
    await auditLog(session.user.id, "CREATE", "Contract", contract.id, `Created contract: ${contract.contractNumber}`);
    return created(contract);
  } catch (e) {
    return handleApiError(e);
  }
}
