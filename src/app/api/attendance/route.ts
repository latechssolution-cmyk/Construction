import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";
import Employee from "@/models/Employee";
import mongoose from "mongoose";

function defaultHours(status: string): number {
  if (status === "present") return 8;
  if (status === "half_day") return 4;
  return 0;
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const month = searchParams.get("month");
    const filter: any = {};
    if (employeeId) filter.employeeId = employeeId;
    if (month) {
      if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month format. Use YYYY-MM");
      const [y, m] = month.split("-").map(Number);
      filter.date = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
    }
    await connectDB();
    const records = await Attendance.find(filter).populate("employee", "id name").sort({ date: -1 }).limit(500);
    return ok(records);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();
    await connectDB();

    if (Array.isArray(data)) {
      // Validation pass
      for (const item of data) {
        if (!item.employeeId || !item.date) continue;
        const date = new Date(item.date);
        if (date > new Date()) throw new ApiError(400, "Attendance date cannot be in the future");
        const status = item.status || "present";
        if (item.hoursWorked !== undefined && item.hoursWorked !== "") {
          const parsed = Number(item.hoursWorked);
          if (isNaN(parsed) || parsed < 0) throw new ApiError(400, "Hours worked cannot be negative");
        }
        const hoursWorked = item.hoursWorked !== undefined && item.hoursWorked !== ""
          ? Math.max(0, Number(item.hoursWorked) || 0)
          : defaultHours(status);
        if (hoursWorked > 24) throw new ApiError(400, "Hours worked cannot exceed 24 hours in a single day.");

        const emp = await Employee.findById(item.employeeId);
        if (!emp) throw new ApiError(404, `Employee with ID ${item.employeeId} not found.`);
        if (!emp.isActive) throw new ApiError(400, `Employee ${emp.name} is deactivated. Cannot record attendance.`);
      }

      const dbSession = await mongoose.startSession();
      const results = [];
      try {
        await dbSession.withTransaction(async () => {
          for (const item of data) {
            if (!item.employeeId || !item.date) continue;
            const status = item.status || "present";
            const hoursWorked = item.hoursWorked !== undefined && item.hoursWorked !== ""
              ? Math.max(0, Number(item.hoursWorked) || 0)
              : defaultHours(status);
            const notes = item.notes?.trim() ? item.notes.trim() : null;

            const date = new Date(item.date);
            const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);

            let existing = await Attendance.findOne({ employeeId: item.employeeId, date: { $gte: dayStart, $lte: dayEnd } }).session(dbSession);
            if (existing) {
              existing.status = status;
              existing.hoursWorked = hoursWorked;
              existing.notes = notes;
              if (item.projectId !== undefined) existing.projectId = toId(item.projectId) as any;
              await existing.save({ session: dbSession });
              results.push(existing);
            } else {
              const [record] = await Attendance.create([{
                employeeId: item.employeeId,
                date: new Date(item.date),
                status,
                hoursWorked,
                notes,
                projectId: toId(item.projectId),
              }], { session: dbSession });
              results.push(record);
            }
          }
        });
      } finally {
        await dbSession.endSession();
      }
      return ok({ success: true, count: results.length });
    }

    if (!data.employeeId || !data.date) throw new Error("employeeId and date are required");
    const date = new Date(data.date);
    if (date > new Date()) throw new ApiError(400, "Attendance date cannot be in the future");
    const status = data.status || "present";
    if (!["present", "absent", "half_day"].includes(status)) throw new Error("status must be present, absent, or half_day");
    if (data.hoursWorked !== undefined && data.hoursWorked !== "") {
      const parsed = Number(data.hoursWorked);
      if (isNaN(parsed) || parsed < 0) throw new ApiError(400, "Hours worked cannot be negative");
    }
    const hoursWorked = data.hoursWorked !== undefined && data.hoursWorked !== ""
      ? Math.max(0, Number(data.hoursWorked) || 0)
      : defaultHours(status);
    if (hoursWorked > 24) throw new ApiError(400, "Hours worked cannot exceed 24 hours in a single day.");

    const emp = await Employee.findById(data.employeeId);
    if (!emp) throw new ApiError(404, `Employee with ID ${data.employeeId} not found.`);
    if (!emp.isActive) throw new ApiError(400, `Employee ${emp.name} is deactivated. Cannot record attendance.`);

    const notes = data.notes?.trim() ? data.notes.trim() : null;
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    const existing = await Attendance.findOne({ employeeId: data.employeeId, date: { $gte: dayStart, $lte: dayEnd } });
    if (existing) {
      existing.status = status;
      existing.hoursWorked = hoursWorked;
      existing.notes = notes;
      if (data.projectId !== undefined) existing.projectId = toId(data.projectId) as any;
      await existing.save();
      await existing.populate("employee", "id name");
      return ok(existing);
    }
    const record = await Attendance.create({
      employeeId: data.employeeId,
      date: new Date(data.date),
      status,
      hoursWorked,
      notes,
      projectId: toId(data.projectId),
    });
    await record.populate("employee", "id name");
    return created(record);
  } catch (e) {
    return handleApiError(e);
  }
}
