import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import ProjectEmployee from "@/models/ProjectEmployee";
import Employee from "@/models/Employee";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id: projectId } = await params;
    const data = await req.json();
    if (!data.employeeId) throw new ApiError(400, "employeeId is required");
    await connectDB();

    const employee = await Employee.findById(data.employeeId);
    if (!employee) throw new ApiError(404, "Employee not found");
    if (!employee.isActive) throw new ApiError(400, "Cannot assign deactivated employee to a project");

    let assignment = await ProjectEmployee.findOne({ projectId, employeeId: data.employeeId });
    if (assignment) {
      assignment.role = data.role || assignment.role;
      assignment.startDate = data.startDate ? new Date(data.startDate) : assignment.startDate;
      assignment.endDate = null; // Reactivate
      await assignment.save();
    } else {
      assignment = await ProjectEmployee.create({
        projectId: toId(projectId),
        employeeId: toId(data.employeeId),
        role: data.role || null,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
        endDate: null,
      });
    }

    await assignment.populate("employee");
    await auditLog(
      session.user.id,
      "CREATE",
      "ProjectEmployee",
      assignment.id,
      `Assigned employee ${employee.name} to project`
    );

    return created(assignment);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id: projectId } = await params;
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    if (!employeeId) throw new ApiError(400, "employeeId is required");
    await connectDB();

    const assignment = await ProjectEmployee.findOne({ projectId, employeeId });
    if (!assignment) throw new ApiError(404, "Assignment not found");
    if (assignment.endDate) throw new ApiError(400, "Employee is already inactive on this project");
    assignment.endDate = new Date();
    await assignment.save();

    await auditLog(
      session.user.id,
      "DELETE",
      "ProjectEmployee",
      assignment.id,
      `Removed employee assignment from project`
    );

    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
