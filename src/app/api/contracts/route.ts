import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { nextContractNumber } from "@/lib/sequence";
import Contract from "@/models/Contract";
import Project from "@/models/Project";
import Counter from "@/models/Counter";

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
    const contractValue = parseFloat(data.contractValue || data.value || "0");
    if (contractValue < 0) throw new ApiError(400, "Contract value cannot be negative");
    const startDate = data.startDate ? new Date(data.startDate) : null;
    const endDate = data.endDate ? new Date(data.endDate) : null;
    if (startDate && endDate && endDate < startDate) {
      throw new ApiError(400, "End date cannot be before start date");
    }
    await connectDB();
    const contract = await Contract.create({
      contractNumber: data.contractNumber || (await nextContractNumber()),
      title: data.title,
      scope: data.scope || null,
      contractValue,
      startDate,
      endDate,
      status: data.status || "draft",
      clientId: toId(data.clientId),
      paymentTerms: data.paymentTerms || null,
      documentPath: data.documentPath || null,
      notes: data.notes || null,
    });
    void auditLog(session.user.id, "CREATE", "Contract", contract.id, `Created contract: ${contract.contractNumber}`);
    return created(contract);
  } catch (e) {
    return handleApiError(e);
  }
}
