import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Partner from "@/models/Partner";
import Investment from "@/models/Investment";

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const partners = await Partner.find({}).sort({ name: 1 }).limit(500).lean({ virtuals: true });
    const ids = (partners as any[]).map((p: any) => p._id);
    const investmentAgg = await Investment.aggregate([
      { $match: { partnerId: { $in: ids } } },
      { $group: { _id: "$partnerId", total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    const invMap = Object.fromEntries(investmentAgg.map((r: any) => [r._id.toString(), { total: r.total, count: r.count }]));
    const result = (partners as any[]).map((p: any) => {
      const id = p._id?.toString() || p.id;
      return { ...p, id, totalInvested: invMap[id]?.total || 0, _count: { investments: invMap[id]?.count || 0 } };
    });
    return ok(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const data = await req.json();
    if (!data.name) throw new ApiError(400, "Partner name is required");
    if (data.equityPercent !== undefined && data.equityPercent !== "") {
      const pct = parseFloat(data.equityPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new ApiError(400, "Equity % must be between 0 and 100");
    }
    await connectDB();
    const partner = await Partner.create({
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      cnicOrCompanyReg: data.cnicOrCompanyReg || null,
      equityPercent: data.equityPercent !== "" && data.equityPercent !== undefined ? parseFloat(data.equityPercent) : undefined,
      notes: data.notes || null,
    });
    void auditLog(session.user.id, "CREATE", "Partner", partner.id, `Added partner: ${partner.name}`);
    return created(partner);
  } catch (e) {
    return handleApiError(e);
  }
}
