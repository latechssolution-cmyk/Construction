import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Client from "@/models/Client";
import Project from "@/models/Project";
import Invoice from "@/models/Invoice";

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const clients = await Client.find({}).sort({ name: 1 }).lean({ virtuals: true });
    const ids = (clients as any[]).map((c: any) => c._id);
    const [projectCounts, invoiceCounts] = await Promise.all([
      Project.aggregate([{ $match: { clientId: { $in: ids } } }, { $group: { _id: "$clientId", count: { $sum: 1 } } }]),
      Invoice.aggregate([{ $match: { clientId: { $in: ids } } }, { $group: { _id: "$clientId", count: { $sum: 1 } } }]),
    ]);
    const pcMap = Object.fromEntries(projectCounts.map((r: any) => [r._id.toString(), r.count]));
    const icMap = Object.fromEntries(invoiceCounts.map((r: any) => [r._id.toString(), r.count]));
    const result = (clients as any[]).map((c: any) => {
      const id = c._id?.toString() || c.id;
      return { ...c, id, _count: { projects: pcMap[id] || 0, invoices: icMap[id] || 0 } };
    });
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
    if (!data.name) throw new Error("Client name is required");
    await connectDB();
    const client = await Client.create({
      name: data.name,
      contactPerson: data.contactPerson || null,
      phone: data.phone || null,
      email: data.email || null,
      address: data.address || null,
      cnicOrCompanyReg: data.cnicOrCompanyReg || null,
      taxId: data.taxId || null,
      notes: data.notes || null,
    });
    void auditLog(session.user.id, "CREATE", "Client", client.id, `Added client: ${client.name}`);
    return created(client);
  } catch (e) {
    return handleApiError(e);
  }
}
