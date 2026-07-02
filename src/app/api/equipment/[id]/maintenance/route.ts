import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { checkBudgetAlert } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Equipment from "@/models/Equipment";
import EquipmentMaintenance from "@/models/EquipmentMaintenance";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const records = await EquipmentMaintenance.find({ equipmentId: id }).sort({ date: -1 });
    return ok(records);
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
    const rawCost = parseFloat(data.cost || "0");
    if (!Number.isFinite(rawCost) || rawCost < 0) throw new ApiError(400, "cost cannot be negative");
    const cost = rawCost;
    await connectDB();
    const projectId = toId(data.projectId);
    const maintBankId = toId(data.bankAccountId);
    const maintDate = data.date ? new Date(data.date) : new Date();

    const record = await withTransaction(async (dbSession) => {
      const [createdRecord] = await EquipmentMaintenance.create(
        [{
          equipmentId: id,
          projectId,
          cost,
          description: data.description || null,
          date: maintDate,
        }],
        { session: dbSession }
      );
      if (data.condition) {
        await Equipment.findByIdAndUpdate(id, { condition: data.condition, status: "maintenance" }, { session: dbSession });
      }
      if (cost > 0) {
        await LedgerEntry.create(
          [{
            date: maintDate,
            type: "expense",
            amount: cost,
            category: "maintenance",
            description: data.description || "Equipment maintenance",
            projectId,
            bankAccountId: maintBankId,
            createdById: session.user.id,
          }],
          { session: dbSession }
        );
        if (maintBankId) {
          await BankAccount.findByIdAndUpdate(maintBankId, { $inc: { balance: -cost } }, { session: dbSession });
        }
      }
      return createdRecord;
    });

    if (cost > 0) void checkBudgetAlert(data.projectId, cost);
    void auditLog(session.user.id, "CREATE", "EquipmentMaintenance", record.id, `Logged maintenance for equipment ${id}: PKR ${cost}`);
    return created(record);
  } catch (e) {
    return handleApiError(e);
  }
}
