import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Asset, { ASSET_CATEGORIES, ASSET_STATUSES } from "@/models/Asset";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const asset = await Asset.findById(id);
    if (!asset) throw new ApiError(404, "Asset not found");
    return ok(asset.toJSON());
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const asset = await Asset.findById(id);
    if (!asset) throw new ApiError(404, "Asset not found");

    if (data.name !== undefined) asset.name = data.name;
    if (data.assetCode !== undefined) asset.assetCode = data.assetCode || undefined;
    if (data.category !== undefined) {
      if (!ASSET_CATEGORIES.includes(data.category)) throw new ApiError(400, "Invalid category");
      asset.category = data.category;
    }
    if (data.status !== undefined) {
      if (!ASSET_STATUSES.includes(data.status)) throw new ApiError(400, "Invalid status");
      asset.status = data.status;
    }
    if (data.purchaseCost !== undefined) {
      const n = parseFloat(data.purchaseCost);
      if (!Number.isFinite(n) || n < 0) throw new ApiError(400, "Purchase cost must be non-negative");
      asset.purchaseCost = n;
    }
    if (data.salvageValue !== undefined) {
      const n = parseFloat(data.salvageValue);
      if (!Number.isFinite(n) || n < 0) throw new ApiError(400, "Salvage value must be non-negative");
      asset.salvageValue = n;
    }
    if (data.usefulLifeYears !== undefined) {
      const n = parseFloat(data.usefulLifeYears);
      if (!Number.isFinite(n) || n < 0) throw new ApiError(400, "Useful life must be non-negative");
      asset.usefulLifeYears = n;
    }
    if (asset.salvageValue > asset.purchaseCost) throw new ApiError(400, "Salvage value cannot exceed purchase cost");
    if (data.purchaseDate !== undefined) asset.purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : null;
    if (data.location !== undefined) asset.location = data.location || undefined;
    if (data.assignedTo !== undefined) asset.assignedTo = data.assignedTo || undefined;
    if (data.lastMaintenanceDate !== undefined) asset.lastMaintenanceDate = data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate) : null;
    if (data.nextMaintenanceDate !== undefined) asset.nextMaintenanceDate = data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : null;
    if (data.notes !== undefined) asset.notes = data.notes || undefined;

    await asset.save();
    void auditLog(session.user.id, "UPDATE", "Asset", id, `Updated asset: ${asset.name}`);
    return ok(asset.toJSON());
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    await connectDB();
    const asset = await Asset.findByIdAndDelete(id);
    if (!asset) throw new ApiError(404, "Asset not found");
    void auditLog(session.user.id, "DELETE", "Asset", id, `Deleted asset: ${asset.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
