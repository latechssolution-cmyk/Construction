import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import ProjectPhase from "@/models/ProjectPhase";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";
import Material from "@/models/Material";
import ProjectEmployee from "@/models/ProjectEmployee";
import ProjectEquipment from "@/models/ProjectEquipment";
import LedgerEntry from "@/models/LedgerEntry";
import Invoice from "@/models/Invoice";
import Doc from "@/models/Document";
import Equipment from "@/models/Equipment";
import Attendance from "@/models/Attendance";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    const project = await Project.findById(id)
      .populate("client")
      .populate("assignedManager", "id name")
      .populate("contract");
    if (!project) throw new ApiError(404, "Project not found");
    if (session.user.role === "manager" && project.assignedManagerId?.toString() !== session.user.id) {
      throw new ApiError(403, "You can only view your assigned projects");
    }
    const [phases, tasks, milestones, materials, employees, equipment, ledgerEntries, invoices, documents] = await Promise.all([
      ProjectPhase.find({ projectId: id }).sort({ order: 1 }).then(async (phases) => {
        await Promise.all(phases.map((ph) => ph.populate({ path: "tasks", populate: { path: "assignedTo", select: "id name" } })));
        return phases;
      }),
      Task.find({ projectId: id }).populate("assignedTo", "id name").sort({ createdAt: 1 }),
      Milestone.find({ projectId: id }).sort({ dueDate: 1 }),
      Material.find({ projectId: id }).populate("vendor", "id name"),
      ProjectEmployee.find({ projectId: id }).populate("employee"),
      ProjectEquipment.find({ projectId: id, returnedAt: null }).populate("equipment"),
      LedgerEntry.find({ projectId: id }).sort({ date: -1 }).limit(50),
      Invoice.find({ projectId: id }).populate("client", "name").sort({ createdAt: -1 }),
      Doc.find({ projectId: id }).populate("uploadedBy", "name").sort({ createdAt: -1 }),
    ]);
    return ok({
      ...project.toJSON(),
      phases,
      tasks,
      milestones,
      materials,
      employees,
      equipment,
      ledgerEntries,
      invoices,
      documents,
    });
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
    const existing = await Project.findById(id, { assignedManagerId: 1 });
    if (!existing) throw new ApiError(404, "Project not found");
    if (session.user.role === "manager" && existing.assignedManagerId?.toString() !== session.user.id) {
      throw new ApiError(403, "You can only edit your assigned projects");
    }
    const clampPct = (v: any) => Math.max(0, Math.min(100, Math.round(Number(v)) || 0));
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.status !== undefined) update.status = data.status;
    if (data.completionPercent !== undefined) update.completionPercent = clampPct(data.completionPercent);
    if (data.budget !== undefined) { const parsedBudget = parseFloat(data.budget); if (!isNaN(parsedBudget)) update.budget = parsedBudget; }
    if (data.location !== undefined) update.location = data.location;
    if (data.description !== undefined) update.description = data.description;
    if (data.startDate !== undefined) update.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.endDate !== undefined) update.endDate = data.endDate ? new Date(data.endDate) : null;
    if (data.clientId !== undefined) update.clientId = toId(data.clientId);
    if (data.assignedManagerId !== undefined) update.assignedManagerId = toId(data.assignedManagerId);
    if (data.contractId !== undefined) update.contractId = toId(data.contractId);
    if (data.type !== undefined) update.type = data.type;
    const project = await Project.findByIdAndUpdate(id, update, { new: true });
    await auditLog(session.user.id, "UPDATE", "Project", id, `Updated project: ${project!.name}`);
    return ok(project);
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
    if (!await Project.exists({ _id: id })) throw new ApiError(404, "Project not found");
    const [hasInvoices, hasLedger] = await Promise.all([
      Invoice.exists({ projectId: id }),
      LedgerEntry.exists({ projectId: id }),
    ]);
    if (hasInvoices || hasLedger) {
      throw new ApiError(400, "Cannot delete project with associated financial records (invoices or ledger entries).");
    }

    // Update equipment statuses to available for active assignments before deleting them
    const activeAssignments = await ProjectEquipment.find({ projectId: id, returnedAt: null });
    const equipmentIds = activeAssignments.map((a) => a.equipmentId);
    if (equipmentIds.length > 0) {
      await Equipment.updateMany({ _id: { $in: equipmentIds } }, { $set: { status: "available" } });
    }

    // Nullify attendance records to represent general overhead
    await Attendance.updateMany({ projectId: id }, { $set: { projectId: null } });

    await Promise.all([
      Task.deleteMany({ projectId: id }),
      Milestone.deleteMany({ projectId: id }),
      Material.deleteMany({ projectId: id }),
      LedgerEntry.deleteMany({ projectId: id }),
      Invoice.deleteMany({ projectId: id }),
      Doc.deleteMany({ projectId: id }),
      ProjectPhase.deleteMany({ projectId: id }),
      ProjectEmployee.deleteMany({ projectId: id }),
      ProjectEquipment.deleteMany({ projectId: id }),
    ]);
    await Project.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "Project", id, "Deleted project and all related data");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
