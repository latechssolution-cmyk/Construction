import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Equipment from "@/models/Equipment";
import ProjectEquipment from "@/models/ProjectEquipment";
import EquipmentMaintenance from "@/models/EquipmentMaintenance";

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const equipment = await Equipment.find({}).sort({ name: 1 }).limit(500);
    const ids = equipment.map((e) => e._id);
    const [assignments, maintenance] = await Promise.all([
      ProjectEquipment.find({ equipmentId: { $in: ids }, returnedAt: null }).populate("project", "id name"),
      EquipmentMaintenance.find({ equipmentId: { $in: ids } }).sort({ date: -1 }),
    ]);
    const assignMap: Record<string, any[]> = {};
    assignments.forEach((a) => {
      const key = a.equipmentId.toString();
      if (!assignMap[key]) assignMap[key] = [];
      assignMap[key].push(a.toJSON());
    });
    const maintMap: Record<string, any[]> = {};
    maintenance.forEach((m) => {
      const key = m.equipmentId.toString();
      if (!maintMap[key]) maintMap[key] = [];
      if (maintMap[key].length < 3) maintMap[key].push(m.toJSON());
    });
    const result = equipment.map((e) => ({
      ...e.toJSON(),
      assignments: assignMap[e.id] || [],
      maintenance: maintMap[e.id] || [],
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
    if (!data.name || !data.type) throw new Error("Name and type are required");
    const pPrice = data.purchasePrice ? parseFloat(data.purchasePrice) : null;
    if (pPrice !== null && pPrice < 0) throw new Error("Purchase price cannot be negative");
    const dRate = data.dailyRate ? parseFloat(data.dailyRate) : 0;
    if (dRate < 0) throw new Error("Daily rate cannot be negative");
    const hRate = data.hourlyRate ? parseFloat(data.hourlyRate) : 0;
    if (hRate < 0) throw new Error("Hourly rate cannot be negative");

    await connectDB();
    const eq = await Equipment.create({
      name: data.name,
      type: data.type,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
      purchasePrice: pPrice,
      condition: data.condition || "good",
      status: data.status || "available",
      dailyRate: dRate,
      hourlyRate: hRate,
      location: data.location || null,
      notes: data.notes || null,
    });
    void auditLog(session.user.id, "CREATE", "Equipment", eq.id, `Added equipment: ${eq.name}`);
    return created(eq);
  } catch (e) {
    return handleApiError(e);
  }
}
