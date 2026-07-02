import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError, assertManagerOwnsProject } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Employee from "@/models/Employee";
import ProjectEmployee from "@/models/ProjectEmployee";

async function assertProjectAccess(session: { user: { id: string; role: string } }, projectId: string) {
  const project = await Project.findById(projectId, { assignedManagerId: 1, name: 1 });
  assertManagerOwnsProject(session, project);
  return project!;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    assertManagerOwnsProject(session, await Project.findById(id, { assignedManagerId: 1 }));
    const assignments = await ProjectEmployee.find({ projectId: id }).populate("employee").sort({ startDate: -1 });
    return ok(assignments);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    if (!data.employeeId) throw new ApiError(400, "employeeId is required");
    await connectDB();
    const project = await assertProjectAccess(session, id);

    const employee = await Employee.findById(data.employeeId, { name: 1, isActive: 1 });
    if (!employee) throw new ApiError(404, "Employee not found");
    if (!employee.isActive) throw new ApiError(400, "Cannot assign a deactivated employee to a project");

    const existing = await ProjectEmployee.findOne({ projectId: id, employeeId: data.employeeId });
    let assignment;
    if (existing) {
      existing.role = data.role || existing.role;
      existing.endDate = null;
      existing.startDate = new Date();
      await existing.save();
      assignment = existing;
    } else {
      assignment = await ProjectEmployee.create({
        projectId: id,
        employeeId: data.employeeId,
        role: data.role || null,
        startDate: new Date(),
      });
    }
    await assignment.populate("employee", "id name role");
    await auditLog(session.user.id, "CREATE", "ProjectEmployee", assignment.id, `Assigned ${employee.name} to project ${project.name}`);
    return created(assignment);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    if (!employeeId) throw new ApiError(400, "employeeId is required");
    await connectDB();
    const project = await assertProjectAccess(session, id);

    const assignment = await ProjectEmployee.findOneAndUpdate(
      { projectId: id, employeeId, endDate: null },
      { endDate: new Date() },
      { new: true }
    );
    if (!assignment) throw new ApiError(404, "Active assignment not found");
    await auditLog(session.user.id, "UPDATE", "ProjectEmployee", assignment.id, `Removed employee ${employeeId} from project ${project.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
