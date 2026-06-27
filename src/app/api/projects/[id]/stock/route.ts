import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const materials = await Material.find({ projectId: id })
      .populate("vendor", "id name")
      .sort({ itemName: 1 });
    const materialIds = materials.map((m) => m._id);
    const usageLogs = await MaterialUsage.find({ materialId: { $in: materialIds } }).sort({ date: -1 });
    const usageMap: Record<string, any[]> = {};
    usageLogs.forEach((u) => {
      const key = u.materialId.toString();
      if (!usageMap[key]) usageMap[key] = [];
      if (usageMap[key].length < 10) usageMap[key].push(u.toJSON());
    });
    const result = materials.map((m) => ({ ...m.toJSON(), usageLogs: usageMap[m.id] || [] }));
    const summary = {
      total: materials.length,
      lowStock: materials.filter((m) => m.stockQuantity <= m.minStockLevel).length,
      outOfStock: materials.filter((m) => m.stockQuantity === 0).length,
      totalValue: materials.reduce((s, m) => s + m.stockQuantity * m.unitPrice, 0),
    };
    return ok({ materials: result, summary });
  } catch (e) {
    return handleApiError(e);
  }
}
