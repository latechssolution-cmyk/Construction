import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import ProjectEmployee from "@/models/ProjectEmployee";
import Attendance from "@/models/Attendance";

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const employees = await Employee.find({}).sort({ name: 1 }).lean({ virtuals: true });
    const ids = (employees as any[]).map((e: any) => e._id);
    const [assignments, attCounts] = await Promise.all([
      ProjectEmployee.find({ employeeId: { $in: ids } }, { employeeId: 1, projectId: 1, role: 1, joinedAt: 1 })
        .populate("project", "id name status").lean({ virtuals: true }),
      Attendance.aggregate([{ $match: { employeeId: { $in: ids } } }, { $group: { _id: "$employeeId", count: { $sum: 1 } } }]),
    ]);
    const assignMap: Record<string, any[]> = {};
    (assignments as any[]).forEach((a: any) => {
      const key = a.employeeId.toString();
      if (!assignMap[key]) assignMap[key] = [];
      assignMap[key].push(a);
    });
    const attMap = Object.fromEntries(attCounts.map((r: any) => [r._id.toString(), r.count]));
    const result = (employees as any[]).map((e: any) => ({
      ...e,
      projectAssignments: assignMap[e.id] || [],
      _count: { attendanceRecords: attMap[e.id] || 0 },
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
    if (!data.name || !data.role) throw new Error("Name and role are required");
    await connectDB();
    const employee = await Employee.create({
      name: data.name,
      role: data.role,
      department: data.department || null,
      phone: data.phone || null,
      email: data.email || null,
      cnic: data.cnic || null,
      address: data.address || null,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
      salary: parseFloat(data.salary || "0"),
      salaryType: data.salaryType || "monthly",
      bankAccount: data.bankAccount || null,
      emergencyContact: data.emergencyContact || null,
      notes: data.notes || null,
    });
    void auditLog(session.user.id, "CREATE", "Employee", employee.id, `Hired: ${employee.name}`);
    return created(employee);
  } catch (e) {
    return handleApiError(e);
  }
}
