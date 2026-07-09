import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const materialId = searchParams.get("materialId");
    await connectDB();
    const logs = await MaterialUsage.find(materialId ? { materialId } : {})
      .populate("material", "itemName unit")
      .populate("usedBy", "name")
      .populate("project", "name")
      .sort({ date: -1 })
      .limit(500);
    return ok(logs);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();
    if (!data.materialId || !data.quantityUsed) throw new Error("materialId and quantityUsed are required");
    await connectDB();
    const material = await Material.findById(data.materialId);
    if (!material) throw new ApiError(404, "Material not found");
    const qty = parseFloat(data.quantityUsed);
    if (qty <= 0) throw new ApiError(400, "quantityUsed must be greater than 0");

    const usageDate = data.date ? new Date(data.date) : new Date();
    if (usageDate > new Date()) throw new ApiError(400, "Usage date cannot be in the future");

    const usage = await withTransaction(async (dbSession) => {
      // Atomic check-and-decrement inside the transaction prevents race conditions
      const updated = await Material.findOneAndUpdate(
        { _id: data.materialId, stockQuantity: { $gte: qty } },
        { $inc: { stockQuantity: -qty } },
        { session: dbSession, new: false }
      );
      if (!updated) {
        const current = await Material.findById(data.materialId, { stockQuantity: 1, unit: 1 }, { session: dbSession });
        throw new ApiError(400, `Insufficient stock. Available: ${current?.stockQuantity ?? 0} ${material.unit}`);
      }
      const destProjectId = toId(data.projectId) || material.projectId;
      const [createdUsage] = await MaterialUsage.create([{
        materialId: data.materialId,
        projectId: destProjectId,
        quantityUsed: qty,
        date: usageDate,
        purpose: data.purpose || null,
        notes: data.notes || null,
        usedById: session.user.id,
      }], { session: dbSession });

      const cost = qty * material.unitPrice;
      await LedgerEntry.create([{
        date: usageDate,
        type: "expense",
        amount: cost,
        category: "material_usage",
        description: `Usage of ${qty} ${material.unit} of ${material.itemName}`,
        projectId: destProjectId,
        createdById: session.user.id,
        referenceNumber: createdUsage._id?.toString() || createdUsage.id,
      }], { session: dbSession });

      await LedgerEntry.create([{
        date: usageDate,
        type: "income",
        amount: cost,
        category: "inventory_asset",
        description: `Inventory offset: Consumption of ${qty} ${material.unit} of ${material.itemName}`,
        projectId: material.projectId,
        createdById: session.user.id,
        referenceNumber: createdUsage._id?.toString() || createdUsage.id,
      }], { session: dbSession });

      return createdUsage;
    });

    const updated = await Material.findById(data.materialId);
    if (updated && updated.stockQuantity <= updated.minStockLevel) {
      await notifyAdminsAndManagers(
        "Low Stock Alert",
        `${material.itemName} stock is at ${updated.stockQuantity} ${material.unit} (min: ${material.minStockLevel})`,
        "warning"
      );
    }
    void auditLog(session.user.id, "CREATE", "MaterialUsage", usage.id, `Used ${qty} ${material.unit} of ${material.itemName}`);
    return created(usage);
  } catch (e) {
    return handleApiError(e);
  }
}
