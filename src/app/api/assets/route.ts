import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Asset, { ASSET_CATEGORIES, ASSET_STATUSES } from "@/models/Asset";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");
    const dueMaintenance = searchParams.get("dueMaintenance");
    const filter: any = {};
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (dueMaintenance === "1") filter.nextMaintenanceDate = { $lte: new Date() };
    await connectDB();
    // toJSON includes the computed currentBookValue / accumulatedDepreciation virtuals.
    const assets = await Asset.find(filter).sort({ name: 1 }).limit(500);
    return ok(assets.map((a) => a.toJSON()));
  } catch (e) {
    return handleApiError(e);
  }
}

function parseNonNeg(val: unknown, label: string): number {
  const n = parseFloat(String(val ?? "0"));
  if (!Number.isFinite(n) || n < 0) throw new ApiError(400, `${label} must be a non-negative number`);
  return n;
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const data = await req.json();
    if (!data.name) throw new ApiError(400, "Asset name is required");
    if (data.category && !ASSET_CATEGORIES.includes(data.category)) throw new ApiError(400, "Invalid category");
    if (data.status && !ASSET_STATUSES.includes(data.status)) throw new ApiError(400, "Invalid status");
    const purchaseCost = parseNonNeg(data.purchaseCost, "Purchase cost");
    const salvageValue = parseNonNeg(data.salvageValue, "Salvage value");
    const usefulLifeYears = parseNonNeg(data.usefulLifeYears ?? 5, "Useful life");
    if (salvageValue > purchaseCost) throw new ApiError(400, "Salvage value cannot exceed purchase cost");
    await connectDB();
    const asset = await Asset.create({
      name: data.name,
      assetCode: data.assetCode || null,
      category: data.category || "other",
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      purchaseCost,
      usefulLifeYears,
      salvageValue,
      status: data.status || "in_use",
      location: data.location || null,
      assignedTo: data.assignedTo || null,
      lastMaintenanceDate: data.lastMaintenanceDate ? new Date(data.lastMaintenanceDate) : null,
      nextMaintenanceDate: data.nextMaintenanceDate ? new Date(data.nextMaintenanceDate) : null,
      notes: data.notes || null,
      createdById: session.user.id,
    });
    void auditLog(session.user.id, "CREATE", "Asset", asset.id, `Added asset: ${asset.name}`);
    return created(asset.toJSON());
  } catch (e) {
    return handleApiError(e);
  }
}
