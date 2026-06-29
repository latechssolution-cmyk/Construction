import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { checkBudgetAlert } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
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
    const cost = isNaN(rawCost) ? 0 : rawCost;
    await connectDB();
    const record = await EquipmentMaintenance.create({
      equipmentId: id,
      projectId: toId(data.projectId),
      cost,
      description: data.description || null,
      date: data.date ? new Date(data.date) : new Date(),
    });
    if (data.condition) {
      await Equipment.findByIdAndUpdate(id, { condition: data.condition, status: "maintenance" });
    }
    const maintBankId = toId(data.bankAccountId);
    if (cost > 0 && maintBankId) {
      await LedgerEntry.create({
        date: record.date,
        type: "expense",
        amount: cost,
        category: "maintenance",
        description: data.description || "Equipment maintenance",
        projectId: toId(data.projectId),
        bankAccountId: maintBankId,
        createdById: session.user.id,
      });
      await BankAccount.findByIdAndUpdate(maintBankId, { $inc: { balance: -cost } });
      void checkBudgetAlert(data.projectId, cost);
    }
    return created(record);
  } catch (e) {
    return handleApiError(e);
  }
}
