import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Partner from "@/models/Partner";
import Investment from "@/models/Investment";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const partner = await Partner.findById(id);
    if (!partner) throw new ApiError(404, "Partner not found");
    const investments = await Investment.find({ partnerId: id })
      .populate("project", "id name")
      .populate("bankAccount", "id name")
      .sort({ date: -1 });
    return ok({ ...partner.toJSON(), investments });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const partner = await Partner.findById(id);
    if (!partner) throw new ApiError(404, "Partner not found");
    const fields = ["name", "contactPerson", "phone", "email", "address", "notes", "cnicOrCompanyReg"] as const;
    fields.forEach((f) => { if (data[f] !== undefined) (partner as any)[f] = data[f]; });
    if (data.equityPercent !== undefined) {
      if (data.equityPercent === "" || data.equityPercent === null) {
        partner.equityPercent = undefined;
      } else {
        const pct = parseFloat(data.equityPercent);
        if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new ApiError(400, "Equity % must be between 0 and 100");
        partner.equityPercent = pct;
      }
    }
    if (data.isActive !== undefined) partner.isActive = data.isActive;
    await partner.save();
    void auditLog(session.user.id, "UPDATE", "Partner", id, `Updated partner: ${partner.name}`);
    return ok(partner);
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
    // Deactivating just hides the partner from new-investment pickers —
    // their existing investment history stays intact and visible, so
    // unlike Client/Vendor there's no "active commitment" to block on.
    await Partner.findByIdAndUpdate(id, { isActive: false });
    void auditLog(session.user.id, "DELETE", "Partner", id, "Deactivated partner");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
