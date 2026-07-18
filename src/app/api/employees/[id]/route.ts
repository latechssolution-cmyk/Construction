import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import ProjectEmployee from "@/models/ProjectEmployee";
import Attendance from "@/models/Attendance";
import User from "@/models/User";
import mongoose from "mongoose";

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
    const fields = ["name","role","department","phone","email","bankAccount","emergencyContact","notes","cnic","address","joiningDate"] as const;
    fields.forEach((f) => { if (data[f] !== undefined) (employee as any)[f] = data[f]; });
    // Activation/deactivation is admin-only — matches the DELETE route's
    // role requirement instead of letting a manager flip it via PUT.
    if (data.isActive !== undefined) {
      requireRole(session, "admin", "ceo");
      employee.isActive = data.isActive;
    }
    if (data.salary !== undefined) {
      const parsedSalary = parseFloat(data.salary);
      if (!isNaN(parsedSalary)) {
        if (parsedSalary < 0) throw new ApiError(400, "Salary cannot be negative");
        employee.salary = parsedSalary;
      }
    }
    if (data.salaryType !== undefined) employee.salaryType = data.salaryType;
    await employee.save();
    void auditLog(session.user.id, "UPDATE", "Employee", id, `Updated employee: ${employee.name}`);
    return ok(employee);
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
    const dbSession = await mongoose.startSession();
    let empName = "";
    try {
      await dbSession.withTransaction(async () => {
        const employee = await Employee.findByIdAndUpdate(id, { isActive: false }, { new: true, session: dbSession });
        if (employee) {
          empName = employee.name;
          await ProjectEmployee.updateMany({ employeeId: id, endDate: null }, { endDate: new Date() }, { session: dbSession });
          if (employee.email) {
            await User.findOneAndUpdate(
              { email: employee.email.toLowerCase().trim() },
              { isActive: false },
              { session: dbSession }
            );
          }
        }
      });
    } finally {
      await dbSession.endSession();
    }
    void auditLog(session.user.id, "DELETE", "Employee", id, `Deactivated: ${empName}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
