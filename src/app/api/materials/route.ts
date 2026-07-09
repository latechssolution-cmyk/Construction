import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers, checkBudgetAlert } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Vendor from "@/models/Vendor";
import mongoose from "mongoose";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    await connectDB();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const skip = (page - 1) * limit;

    const total = await Material.countDocuments(filter);
    const materials = await Material.find(filter)
      .populate("project", "id name")
      .populate("vendor", "id name")
      .sort({ itemName: 1 })
      .skip(skip)
      .limit(limit)
      .lean({ virtuals: true });
    const ids = (materials as any[]).map((m: any) => m._id);
    // Cap usage log fetch — at most 5 per material, hard limit avoids over-fetching on large data
    const usageLogs = await MaterialUsage.find({ materialId: { $in: ids } })
      .sort({ date: -1 })
      .limit(Math.max(ids.length * 5, 50))
      .lean();
    const usageMap: Record<string, any[]> = {};
    (usageLogs as any[]).forEach((u: any) => {
      const key = u.materialId.toString();
      if (!usageMap[key]) usageMap[key] = [];
      if (usageMap[key].length < 5) usageMap[key].push(u);
    });
    const entries = (materials as any[]).map((m: any) => {
      const id = m._id?.toString() || m.id;
      return { ...m, id, usageLogs: usageMap[id] || [] };
    });

    return ok({
      data: entries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      }
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();
    if (!data.itemName || !data.projectId) throw new Error("Item name and project are required");
    const qty = parseFloat(data.quantity || "0");
    const price = parseFloat(data.unitPrice || "0");
    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, "quantity must be a positive number");
    if (!Number.isFinite(price) || price < 0) throw new ApiError(400, "unitPrice cannot be negative");
    await connectDB();
    const totalPrice = qty * price;
    const minStock = parseFloat(data.minStockLevel || "5");
    const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
    const bankAccountId = toId(data.bankAccountId);
    const vendorId = toId(data.vendorId);
    const projectId = toId(data.projectId);

    const material = await withTransaction(async (dbSession) => {
      const [createdMaterial] = await Material.create(
        [{
          itemName: data.itemName,
          category: data.category || "general",
          unit: data.unit || "pcs",
          quantity: qty,
          stockQuantity: qty,
          minStockLevel: minStock,
          unitPrice: price,
          totalPrice,
          receivedDate,
          projectId,
          vendorId,
          notes: data.notes || null,
        }],
        { session: dbSession }
      );
      if (totalPrice > 0) {
        await LedgerEntry.create(
          [{
            date: receivedDate,
            type: "expense",
            amount: totalPrice,
            category: "material_purchase",
            description: `${data.itemName} × ${qty} ${createdMaterial.unit}`,
            referenceNumber: createdMaterial._id.toString(),
            projectId,
            vendorId,
            bankAccountId,
            createdById: session.user.id,
          }],
          { session: dbSession }
        );
        if (bankAccountId) {
          await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: -totalPrice } }, { session: dbSession });
        }
      }
      return createdMaterial;
    });


    if (qty <= minStock) {
      void notifyAdminsAndManagers("Low Stock Alert", `${material.itemName} stock is low (${qty} ${material.unit} remaining)`, "warning");
    }
    void checkBudgetAlert(data.projectId, totalPrice);
    void auditLog(session.user.id, "CREATE", "Material", material.id || material._id?.toString(), `Added material: ${material.itemName}`);
    return created(material);
  } catch (e) {
    return handleApiError(e);
  }
}
