import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok, assertManagerOwnsProject } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    assertManagerOwnsProject(session, await Project.findById(id, { assignedManagerId: 1 }));
    const materials = await Material.find({ projectId: id })
      .populate("vendor", "id name")
      .sort({ itemName: 1 });

    // Get all usage logs that occurred on this project (direct or transferred)
    const usageLogs = await MaterialUsage.find({ projectId: id })
      .populate({
        path: "material",
        populate: { path: "vendor", select: "id name" }
      })
      .sort({ date: -1 });

    // Collect all materials involved (purchased + used from other projects)
    const materialMap = new Map<string, any>();
    materials.forEach((m) => {
      materialMap.set(m.id, { ...m.toJSON(), usageLogs: [] });
    });

    usageLogs.forEach((u) => {
      const uAny = u as any;
      if (uAny.material) {
        const mat = uAny.material;
        if (!materialMap.has(mat.id)) {
          materialMap.set(mat.id, { ...mat.toJSON(), usageLogs: [] });
        }
      }
    });

    // Populate usage logs into each material's list (only including logs relevant to this project)
    usageLogs.forEach((u) => {
      const matId = u.materialId.toString();
      const mat = materialMap.get(matId);
      if (mat && mat.usageLogs.length < 10) {
        mat.usageLogs.push(u.toJSON());
      }
    });

    const result = Array.from(materialMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));

    const summary = {
      total: result.length,
      lowStock: materials.filter((m) => m.stockQuantity <= m.minStockLevel).length,
      outOfStock: materials.filter((m) => m.stockQuantity === 0).length,
      totalValue: materials.reduce((s, m) => s + m.stockQuantity * m.unitPrice, 0),
    };
    return ok({ materials: result, summary });
  } catch (e) {
    return handleApiError(e);
  }
}
