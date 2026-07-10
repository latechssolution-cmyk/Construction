import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import { assertDateRange, parseOptionalDate, parseOptionalNonNegativeNumber } from "@/lib/validation";
import Project from "@/models/Project";
import ProjectPhase from "@/models/ProjectPhase";
import Task from "@/models/Task";
import Milestone from "@/models/Milestone";
import Material from "@/models/Material";
import ProjectEmployee from "@/models/ProjectEmployee";
import ProjectEquipment from "@/models/ProjectEquipment";
import Equipment from "@/models/Equipment";
import LedgerEntry from "@/models/LedgerEntry";
import Invoice from "@/models/Invoice";
import Doc from "@/models/Document";
import Attendance from "@/models/Attendance";
import Subcontract from "@/models/Subcontract";

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
    const [phases, tasks, milestones, materials, employees, equipment, ledgerEntries, invoices, documents, subcontracts] = await Promise.all([
      ProjectPhase.find({ projectId: id }).sort({ order: 1 }),
      Task.find({ projectId: id }).populate("assignedTo", "id name").sort({ createdAt: 1 }),
      Milestone.find({ projectId: id }).sort({ dueDate: 1 }),
      Material.find({ projectId: id }).populate("vendor", "id name"),
      ProjectEmployee.find({ projectId: id }).populate("employee"),
      ProjectEquipment.find({ projectId: id, returnedAt: null }).populate("equipment"),
      LedgerEntry.find({ projectId: id }).populate("bankAccount", "id name").populate("vendor", "id name").sort({ date: -1 }).limit(50),
      Invoice.find({ projectId: id }).populate("client", "name").sort({ createdAt: -1 }),
      Doc.find({ projectId: id }).populate("uploadedBy", "name").sort({ createdAt: -1 }),
      Subcontract.find({ projectId: id }).populate("vendor", "id name category contactPerson phone").sort({ createdAt: -1 }),
    ]);

    // Attach each phase's tasks by grouping the already-fetched flat `tasks`
    // array instead of re-querying per phase — the old code called
    // ph.populate("tasks", {populate: "assignedTo"}) once per phase, which
    // is an N+1 query pattern (2 extra round trips per phase) for data this
    // route was already fetching flat above. This is the query the "toggle
    // a task checkbox" mutate() was waiting on.
    const tasksByPhase: Record<string, any[]> = {};
    for (const t of tasks as any[]) {
      const key = t.phaseId?.toString();
      if (!key) continue;
      (tasksByPhase[key] ||= []).push(t);
    }
    const phasesWithTasks = (phases as any[]).map((ph) => ({
      ...ph.toJSON(),
      tasks: tasksByPhase[ph.id] || [],
    }));

    return ok({
      ...project.toJSON(),
      phases: phasesWithTasks,
      tasks,
      milestones,
      materials,
      employees,
      equipment,
      ledgerEntries,
      invoices,
      documents,
      subcontracts,
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
    const existing = await Project.findById(id, { assignedManagerId: 1, startDate: 1, endDate: 1 });
    if (!existing) throw new ApiError(404, "Project not found");
    const currentManagerId = existing.assignedManagerId?.toString() || null;
    if (session.user.role === "manager" && existing.assignedManagerId?.toString() !== session.user.id) {
      throw new ApiError(403, "You can only edit your assigned projects");
    }
    const update: any = {};
    if (data.name !== undefined) update.name = data.name;
    if (data.status !== undefined) update.status = data.status;
    // completionPercent is intentionally not settable here — it's derived
    // entirely from task weights/status via recomputeProjectCompletion(),
    // there is no manual override anymore.
    if (data.budget !== undefined) update.budget = parseOptionalNonNegativeNumber(data.budget, "Budget");
    if (data.location !== undefined) update.location = data.location;
    if (data.description !== undefined) update.description = data.description;
    if (data.startDate !== undefined) update.startDate = parseOptionalDate(data.startDate, "Start date");
    if (data.endDate !== undefined) update.endDate = parseOptionalDate(data.endDate, "End date");
    assertDateRange(
      update.startDate !== undefined ? update.startDate : (existing as any).startDate,
      update.endDate !== undefined ? update.endDate : (existing as any).endDate
    );
    if (data.clientId !== undefined) update.clientId = toId(data.clientId);
    // Reassigning a project to a different manager is an admin/ceo decision
    // — a manager reassigning their own project could hand it off (or dump
    // it) without oversight otherwise. The project edit form always submits
    // the full object, so only gate this when the value actually changes.
    if (data.assignedManagerId !== undefined) {
      const newManagerId = toId(data.assignedManagerId);
      if (newManagerId !== currentManagerId) {
        requireRole(session, "admin", "ceo");
      }
      update.assignedManagerId = newManagerId;
    }
    if (data.contractId !== undefined) update.contractId = toId(data.contractId);
    if (data.type !== undefined) update.type = data.type;
    const project = await Project.findByIdAndUpdate(id, update, { new: true });
    void auditLog(session.user.id, "UPDATE", "Project", id, `Updated project: ${project!.name}`);
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
    const project = await Project.findById(id, { name: 1 });
    if (!project) throw new ApiError(404, "Project not found");

    const [ledgerCount, invoiceCount] = await Promise.all([
      LedgerEntry.countDocuments({ projectId: id }),
      Invoice.countDocuments({ projectId: id, deletedAt: null }),
    ]);
    if (ledgerCount > 0 || invoiceCount > 0) {
      throw new ApiError(
        400,
        `Cannot delete project "${project.name}": it has ${ledgerCount} ledger ${ledgerCount === 1 ? "entry" : "entries"} and ${invoiceCount} invoice(s) linked. Set its status to "cancelled" instead of deleting it, to preserve financial history.`
      );
    }

    const activeAssignments = await ProjectEquipment.find({ projectId: id, returnedAt: null }, { equipmentId: 1 });
    if (activeAssignments.length > 0) {
      await Equipment.updateMany(
        { _id: { $in: activeAssignments.map((a) => a.equipmentId) } },
        { status: "available" }
      );
    }


    await Promise.all([
      Task.deleteMany({ projectId: id }),
      Milestone.deleteMany({ projectId: id }),
      Material.deleteMany({ projectId: id }),
      Doc.deleteMany({ projectId: id }),
      ProjectPhase.deleteMany({ projectId: id }),
      ProjectEmployee.deleteMany({ projectId: id }),
      ProjectEquipment.deleteMany({ projectId: id }),
    ]);
    await Project.findByIdAndDelete(id);
    void auditLog(session.user.id, "DELETE", "Project", id, "Deleted project and all related data");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
