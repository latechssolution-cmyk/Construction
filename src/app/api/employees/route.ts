import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Employee from "@/models/Employee";
import ProjectEmployee from "@/models/ProjectEmployee";
import Attendance from "@/models/Attendance";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.max(1, parseInt(searchParams.get("limit") || "50"));
    const skip = (page - 1) * limit;

    const total = await Employee.countDocuments({});
    const employees = await Employee.find({}).sort({ name: 1 }).skip(skip).limit(limit).lean({ virtuals: true });
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
    const entries = (employees as any[]).map((e: any) => {
      const id = e._id?.toString() || e.id;
      return { ...e, id, projectAssignments: assignMap[id] || [], _count: { attendanceRecords: attMap[id] || 0 } };
    });

    return ok({
      data: entries,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      }
    });
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
    // Issue #72: Block ghost employees with duplicate CNIC
    if (data.cnic && data.cnic.trim()) {
      const existingCnic = await Employee.findOne({ cnic: data.cnic.trim() });
      if (existingCnic) {
        throw new Error(`An employee with CNIC ${data.cnic} already exists: ${existingCnic.name}`);
      }
    }
    const sal = parseFloat(data.salary || "0");
    if (sal < 0) throw new Error("Salary cannot be negative");
    const employee = await Employee.create({
      name: data.name,
      role: data.role,
      department: data.department || null,
      phone: data.phone || null,
      email: data.email || null,
      cnic: data.cnic || null,
      address: data.address || null,
      joiningDate: data.joiningDate ? new Date(data.joiningDate) : new Date(),
      salary: sal,
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
