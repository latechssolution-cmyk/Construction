import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Vendor from "@/models/Vendor";
import Material from "@/models/Material";
import LedgerEntry from "@/models/LedgerEntry";
import Subcontract from "@/models/Subcontract";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const vendor = await Vendor.findById(id);
    if (!vendor) throw new ApiError(404, "Vendor not found");
    const [materials, ledgerEntries] = await Promise.all([
      Material.find({ vendorId: id }, { itemName: 1, quantity: 1, unit: 1, totalPrice: 1 }).sort({ createdAt: -1 }),
      LedgerEntry.find({ vendorId: id }, { date: 1, amount: 1, category: 1, type: 1 }).sort({ date: -1 }).limit(20),
    ]);
    return ok({ ...vendor.toJSON(), materials, ledgerEntries });
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
    const vendor = await Vendor.findById(id);
    if (!vendor) throw new ApiError(404, "Vendor not found");
    const fields = ["name","category","contactPerson","phone","email","notes","bankAccount","taxId"] as const;
    fields.forEach((f) => { if (data[f] !== undefined) (vendor as any)[f] = data[f]; });
    // Activation/deactivation is admin/ceo only — matches the DELETE route's
    // role requirement instead of letting a manager flip it via PUT.
    if (data.isActive !== undefined) {
      requireRole(session, "admin", "ceo");
      if (data.isActive === false) {
        const openSubcontracts = await Subcontract.countDocuments({ vendorId: id, status: "in_progress" });
        if (openSubcontracts > 0) {
          throw new ApiError(400, `Cannot deactivate vendor: ${openSubcontracts} open subcontract(s) still assigned. Complete or reassign those first.`);
        }
      }
      vendor.isActive = data.isActive;
    }
    await vendor.save();
    void auditLog(session.user.id, "UPDATE", "Vendor", id, `Updated vendor: ${vendor.name}`);
    return ok(vendor);
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
    const openSubcontracts = await Subcontract.countDocuments({ vendorId: id, status: "in_progress" });
    if (openSubcontracts > 0) {
      throw new ApiError(400, `Cannot deactivate vendor: ${openSubcontracts} open subcontract(s) still assigned. Complete or reassign those first.`);
    }
    await Vendor.findByIdAndUpdate(id, { isActive: false });
    void auditLog(session.user.id, "DELETE", "Vendor", id, "Deactivated vendor");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
