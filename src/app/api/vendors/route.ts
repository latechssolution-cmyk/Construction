import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Vendor from "@/models/Vendor";
import Material from "@/models/Material";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const vendors = await Vendor.find({}).sort({ createdAt: -1 }).lean({ virtuals: true });
    const ids = (vendors as any[]).map((v: any) => v._id);
    const [matCounts, ledCounts] = await Promise.all([
      Material.aggregate([{ $match: { vendorId: { $in: ids } } }, { $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
      LedgerEntry.aggregate([{ $match: { vendorId: { $in: ids } } }, { $group: { _id: "$vendorId", count: { $sum: 1 } } }]),
    ]);
    const mcMap = Object.fromEntries(matCounts.map((r: any) => [r._id.toString(), r.count]));
    const lcMap = Object.fromEntries(ledCounts.map((r: any) => [r._id.toString(), r.count]));
    const result = (vendors as any[]).map((v: any) => ({
      ...v,
      _count: { materials: mcMap[v.id] || 0, ledgerEntries: lcMap[v.id] || 0 },
    }));
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
    if (!data.name) throw new Error("Vendor name is required");
    await connectDB();
    const vendor = await Vendor.create({
      name: data.name,
      contactPerson: data.contactPerson || null,
      email: data.email || null,
      phone: data.phone || null,
      address: data.address || null,
      category: data.category || "general",
      taxId: data.taxId || null,
      bankAccount: data.bankAccount || null,
      notes: data.notes || null,
    });
    void auditLog(session.user.id, "CREATE", "Vendor", vendor.id, `Created vendor: ${vendor.name}`);
    return created(vendor);
  } catch (e) {
    return handleApiError(e);
  }
}
