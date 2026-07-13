import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError, assertManagerOwnsProject } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Investment from "@/models/Investment";
import Partner from "@/models/Partner";
import Project from "@/models/Project";
import BankAccount from "@/models/BankAccount";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const partnerId = searchParams.get("partnerId");
    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    if (partnerId) filter.partnerId = partnerId;
    await connectDB();
    if (session.user.role === "manager") {
      if (!projectId) throw new ApiError(400, "projectId is required");
      const project = await Project.findById(projectId, { assignedManagerId: 1 });
      assertManagerOwnsProject(session, project);
    }
    const investments = await Investment.find(filter)
      .populate("partner", "id name")
      .populate("project", "id name")
      .populate("bankAccount", "id name")
      .sort({ date: -1 })
      .limit(500);
    return ok(investments);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const data = await req.json();
    if (!data.partnerId) throw new ApiError(400, "partnerId is required");
    if (!data.projectId) throw new ApiError(400, "projectId is required");
    const amount = parseFloat(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new ApiError(400, "amount must be a positive number");

    await connectDB();
    const [partner, project] = await Promise.all([
      Partner.findById(data.partnerId),
      Project.findById(data.projectId, { name: 1 }),
    ]);
    if (!partner) throw new ApiError(404, "Partner not found");
    if (!project) throw new ApiError(404, "Project not found");

    const bankAccountId = toId(data.bankAccountId);
    const date = data.date ? new Date(data.date) : new Date();

    // An investment is a capital injection, not earned revenue — it must
    // NOT flow through LedgerEntry (which drives Total Revenue / Gross
    // Profit on every dashboard). It still represents real cash arriving,
    // so — same as loans — it adjusts the bank account balance directly.
    const investment = await withTransaction(async (dbSession) => {
      const [createdInvestment] = await Investment.create(
        [{
          partnerId: data.partnerId,
          projectId: data.projectId,
          amount,
          date,
          bankAccountId,
          notes: data.notes || null,
          createdById: session.user.id,
        }],
        { session: dbSession }
      );
      if (bankAccountId) {
        const bankAccount = await BankAccount.findById(bankAccountId, null, { session: dbSession });
        if (!bankAccount) throw new ApiError(404, "Bank account not found");
        await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: amount } }, { session: dbSession });
      }
      return createdInvestment;
    });

    void auditLog(session.user.id, "CREATE", "Investment", investment.id, `${partner.name} invested PKR ${amount} in ${project.name}`);
    return created(investment);
  } catch (e) {
    return handleApiError(e);
  }
}
