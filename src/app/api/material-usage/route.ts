import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError, toId } from "@/lib/api-helpers";
import { notifyAdminsAndManagers } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";
import LedgerEntry from "@/models/LedgerEntry";
import mongoose from "mongoose";

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
    const dbSession = await mongoose.startSession();
    let usage: any;
    try {
      await dbSession.withTransaction(async () => {
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

        [usage] = await MaterialUsage.create([{
          materialId: data.materialId,
          projectId: destProjectId,
          quantityUsed: qty,
          date: data.date ? new Date(data.date) : new Date(),
          purpose: data.purpose || null,
          notes: data.notes || null,
          usedById: session.user.id,
        }], { session: dbSession });

        const cost = qty * material.unitPrice;
        await LedgerEntry.create([{
          date: data.date ? new Date(data.date) : new Date(),
          type: "expense",
          amount: cost,
          category: "material_usage",
          description: `Usage of ${qty} ${material.unit} of ${material.itemName}`,
          projectId: destProjectId,
          createdById: session.user.id,
          referenceNumber: usage._id?.toString() || usage.id,
        }], { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }
    const updated = await Material.findById(data.materialId);
    if (updated && updated.stockQuantity <= updated.minStockLevel) {
      await notifyAdminsAndManagers(
        "Low Stock Alert",
        `${material.itemName} stock is at ${updated.stockQuantity} ${material.unit} (min: ${material.minStockLevel})`,
        "warning"
      );
    }
    return created(usage);
  } catch (e) {
    return handleApiError(e);
  }
}
