import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    await connectDB();
    const materials = await Material.find(filter)
      .populate("project", "id name")
      .populate("vendor", "id name")
      .sort({ itemName: 1 })
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
    const result = (materials as any[]).map((m: any) => ({ ...m, usageLogs: usageMap[m.id] || [] }));
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
    if (!data.itemName || !data.projectId) throw new Error("Item name and project are required");
    await connectDB();
    const qty = parseFloat(data.quantity || "0");
    const price = parseFloat(data.unitPrice || "0");
    const totalPrice = qty * price;
    const minStock = parseFloat(data.minStockLevel || "5");
    const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
    const material = await Material.create({
      itemName: data.itemName,
      category: data.category || "general",
      unit: data.unit || "pcs",
      quantity: qty,
      stockQuantity: qty,
      minStockLevel: minStock,
      unitPrice: price,
      totalPrice,
      receivedDate,
      projectId: toId(data.projectId),
      vendorId: toId(data.vendorId),
      notes: data.notes || null,
    });
    if (totalPrice > 0) {
      await LedgerEntry.create({
        date: receivedDate,
        type: "expense",
        amount: totalPrice,
        category: "material_purchase",
        description: `${data.itemName} × ${qty} ${material.unit}`,
        projectId: toId(data.projectId),
        vendorId: toId(data.vendorId),
        bankAccountId: toId(data.bankAccountId),
        createdById: session.user.id,
      });
    }
    if (qty <= minStock) {
      void notifyAdminsAndManagers("Low Stock Alert", `${material.itemName} stock is low (${qty} ${material.unit} remaining)`, "warning");
    }
    void auditLog(session.user.id, "CREATE", "Material", material.id, `Added material: ${material.itemName}`);
    return created(material);
  } catch (e) {
    return handleApiError(e);
  }
}
