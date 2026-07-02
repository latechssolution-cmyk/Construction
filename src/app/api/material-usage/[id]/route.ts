import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";
import LedgerEntry from "@/models/LedgerEntry";
import mongoose from "mongoose";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    await connectDB();

    const usage = await MaterialUsage.findById(id);
    if (!usage) throw new ApiError(404, "Material usage log not found");

    const material = await Material.findById(usage.materialId);
    if (!material) throw new ApiError(404, "Associated material not found");

    const oldQty = usage.quantityUsed;
    const newQty = data.quantityUsed !== undefined ? parseFloat(data.quantityUsed) : oldQty;
    if (isNaN(newQty) || newQty <= 0) throw new ApiError(400, "quantityUsed must be greater than 0");

    const diff = newQty - oldQty;

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        if (diff > 0) {
          // Check and decrement stock atomically
          const updated = await Material.findOneAndUpdate(
            { _id: usage.materialId, stockQuantity: { $gte: diff } },
            { $inc: { stockQuantity: -diff } },
            { session: dbSession, new: false }
          );
          if (!updated) {
            const current = await Material.findById(usage.materialId, { stockQuantity: 1 }, { session: dbSession });
            throw new ApiError(400, `Insufficient stock. Additional required: ${diff}, Available: ${current?.stockQuantity ?? 0}`);
          }
        } else if (diff < 0) {
          // Increment stock back
          await Material.findByIdAndUpdate(
            usage.materialId,
            { $inc: { stockQuantity: Math.abs(diff) } },
            { session: dbSession }
          );
        }

        usage.quantityUsed = newQty;
        if (data.purpose !== undefined) usage.purpose = data.purpose || null;
        if (data.notes !== undefined) usage.notes = data.notes || null;
        if (data.date !== undefined) usage.date = new Date(data.date);
        if (data.projectId !== undefined) usage.projectId = toId(data.projectId) as any;
        await usage.save({ session: dbSession });

        const cost = newQty * material.unitPrice;
        await LedgerEntry.findOneAndUpdate(
          { referenceNumber: id, category: "material_usage" },
          {
            amount: cost,
            date: usage.date,
            description: `Usage of ${newQty} ${material.unit} of ${material.itemName}`,
            projectId: usage.projectId || material.projectId,
          },
          { session: dbSession }
        );
      });
    } finally {
      await dbSession.endSession();
    }

    return ok(usage);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    await connectDB();

    const usage = await MaterialUsage.findById(id);
    if (!usage) throw new ApiError(404, "Material usage log not found");

    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        // Return quantity to stock
        await Material.findByIdAndUpdate(
          usage.materialId,
          { $inc: { stockQuantity: usage.quantityUsed } },
          { session: dbSession }
        );

        // Delete associated ledger entry
        await LedgerEntry.findOneAndDelete(
          { referenceNumber: id, category: "material_usage" },
          { session: dbSession }
        );

        // Delete material usage log
        await MaterialUsage.findByIdAndDelete(id, { session: dbSession });
      });
    } finally {
      await dbSession.endSession();
    }

    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
