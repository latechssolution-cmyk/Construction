import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Client from "@/models/Client";
import Project from "@/models/Project";
import Invoice from "@/models/Invoice";
import Contract from "@/models/Contract";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const client = await Client.findById(id);
    if (!client) throw new ApiError(404, "Client not found");
    const [projects, invoices, contracts] = await Promise.all([
      Project.find({ clientId: id }, { name: 1, status: 1 }),
      Invoice.find({ clientId: id }, { invoiceNumber: 1, grandTotal: 1, status: 1 }).sort({ createdAt: -1 }),
      Contract.find({ clientId: id }, { contractNumber: 1, contractValue: 1, status: 1 }),
    ]);
    return ok({ ...client.toJSON(), projects, invoices, contracts });
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
    const client = await Client.findById(id);
    if (!client) throw new ApiError(404, "Client not found");
    const fields = ["name","contactPerson","phone","email","address","notes","cnicOrCompanyReg","taxId"] as const;
    fields.forEach((f) => { if (data[f] !== undefined) (client as any)[f] = data[f]; });
    // isActive is only settable by admin/ceo, and only through the same
    // "no active projects/contracts" guard DELETE enforces — otherwise a
    // manager could deactivate a client with live projects via this route.
    if (data.isActive !== undefined && data.isActive !== client.isActive) {
      requireRole(session, "admin", "ceo");
      if (data.isActive === false) {
        const [activeProjects, activeContracts] = await Promise.all([
          Project.countDocuments({ clientId: id, status: { $nin: ["financially_closed", "cancelled"] } }),
          Contract.countDocuments({ clientId: id, status: { $in: ["draft", "active", "on_hold"] } }),
        ]);
        if (activeProjects > 0) throw new ApiError(400, `Cannot deactivate client: ${activeProjects} active project(s) still linked. Complete or cancel those projects first.`);
        if (activeContracts > 0) throw new ApiError(400, `Cannot deactivate client: ${activeContracts} active contract(s) still linked. Terminate those contracts first.`);
      }
      client.isActive = data.isActive;
    }
    await client.save();
    void auditLog(session.user.id, "UPDATE", "Client", id, `Updated client: ${client.name}`);
    return ok(client);
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
    const [activeProjects, activeContracts] = await Promise.all([
      Project.countDocuments({ clientId: id, status: { $nin: ["financially_closed","cancelled"] } }),
      Contract.countDocuments({ clientId: id, status: { $in: ["draft","active","on_hold"] } }),
    ]);
    if (activeProjects > 0) throw new ApiError(400, `Cannot deactivate client: ${activeProjects} active project(s) still linked. Complete or cancel those projects first.`);
    if (activeContracts > 0) throw new ApiError(400, `Cannot deactivate client: ${activeContracts} active contract(s) still linked. Terminate those contracts first.`);
    await Client.findByIdAndUpdate(id, { isActive: false });
    void auditLog(session.user.id, "DELETE", "Client", id, "Deactivated client");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
