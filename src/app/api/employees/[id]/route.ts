import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import ProjectEmployee from "@/models/ProjectEmployee";
import Attendance from "@/models/Attendance";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const employee = await Employee.findById(id);
    if (!employee) throw new ApiError(404, "Employee not found");
    const [projectAssignments, attendanceRecords] = await Promise.all([
      ProjectEmployee.find({ employeeId: id }).populate("project", "id name status"),
      Attendance.find({ employeeId: id }).sort({ date: -1 }).limit(60),
    ]);
    return ok({ ...employee.toJSON(), projectAssignments, attendanceRecords });
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
    const employee = await Employee.findById(id);
    if (!employee) throw new ApiError(404, "Employee not found");
    const fields = ["name","role","department","phone","email","isActive","bankAccount","emergencyContact","notes"] as const;
    fields.forEach((f) => { if (data[f] !== undefined) (employee as any)[f] = data[f]; });
    if (data.salary !== undefined) { const parsedSalary = parseFloat(data.salary); if (!isNaN(parsedSalary)) employee.salary = parsedSalary; }
    if (data.salaryType !== undefined) employee.salaryType = data.salaryType;
    await employee.save();
    await auditLog(session.user.id, "UPDATE", "Employee", id, `Updated employee: ${employee.name}`);
    return ok(employee);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin");
    const { id } = await params;
    await connectDB();
    const employee = await Employee.findByIdAndUpdate(id, { isActive: false }, { new: true });
    await ProjectEmployee.updateMany({ employeeId: id, endDate: null }, { endDate: new Date() });
    await auditLog(session.user.id, "DELETE", "Employee", id, `Deactivated: ${employee?.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
