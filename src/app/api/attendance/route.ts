import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Attendance from "@/models/Attendance";

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
    if (!data.employeeId || !data.date) throw new Error("employeeId and date are required");
    const status = data.status || "present";
    if (!["present", "absent", "half_day"].includes(status)) throw new Error("status must be present, absent, or half_day");
    await connectDB();
    const hoursWorked = data.hoursWorked !== undefined && data.hoursWorked !== ""
      ? Math.max(0, Number(data.hoursWorked) || 0)
      : defaultHours(status);
    const notes = data.notes?.trim() ? data.notes.trim() : null;
    const date = new Date(data.date);
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
