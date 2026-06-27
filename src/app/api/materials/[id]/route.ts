import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const material = await Material.findById(id)
      .populate("project", "id name")
      .populate("vendor", "id name");
    if (!material) throw new ApiError(404, "Material not found");
    const usageLogs = await MaterialUsage.find({ materialId: id }).sort({ date: -1 });
    return ok({ ...material.toJSON(), usageLogs });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const material = await Material.findById(id);
    if (!material) throw new ApiError(404, "Material not found");
    const qty = data.quantity !== undefined ? parseFloat(data.quantity) : undefined;
    const price = data.unitPrice !== undefined ? parseFloat(data.unitPrice) : undefined;
    if (data.itemName !== undefined) material.itemName = data.itemName;
    if (data.category !== undefined) material.category = data.category;
    if (data.unit !== undefined) material.unit = data.unit;
    if (qty !== undefined) material.quantity = qty;
    if (data.stockQuantity !== undefined) material.stockQuantity = parseFloat(data.stockQuantity);
    if (data.minStockLevel !== undefined) material.minStockLevel = parseFloat(data.minStockLevel);
    if (price !== undefined) material.unitPrice = price;
    if (qty !== undefined && price !== undefined) material.totalPrice = qty * price;
    if (data.vendorId !== undefined) material.vendorId = data.vendorId || null;
    if (data.notes !== undefined) material.notes = data.notes;
    await material.save();
    await auditLog(session.user.id, "UPDATE", "Material", id, `Updated: ${material.itemName}`);
    return ok(material);
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
    await Material.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "Material", id, "Deleted material");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
