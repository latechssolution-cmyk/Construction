"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ExportButton } from "@/components/export-button";
import { Lock, Calendar, Trash2, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// AttendanceStatus enum: present | absent | half_day
const STATUS_COLORS: Record<string, string> = {
  present: "bg-green-100 text-green-700",
  absent: "bg-red-100 text-red-700",
  half_day: "bg-yellow-100 text-yellow-700",
};
const STATUSES = ["present", "absent", "half_day"];
const defaultHours = (s: string) => (s === "present" ? 8 : s === "half_day" ? 4 : 0);
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function AttendancePage() {
  const { data: session } = useSession();
  const [month, setMonth] = useState(currentMonth());
  const { data: records, mutate, isLoading } = useSWR(`/api/attendance?month=${month}`, fetcher);
  const { data: employees } = useSWR("/api/employees", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ status: "present", date: new Date().toISOString().slice(0, 10), hoursWorked: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  if (session && !["admin", "ceo", "manager"].includes(session.user?.role || "")) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="font-medium">Access Restricted</p>
      </div>
    );
  }

  const canManage = ["admin", "manager"].includes(session?.user?.role || "");
  const list: any[] = Array.isArray(records) ? records : [];
  const empList: any[] = Array.isArray(employees) ? employees : [];

  const filtered = list.filter((r: any) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (employeeFilter && r.employee?.id !== employeeFilter) return false;
    return true;
  });

  // Group filtered records by calendar date (desc)
  const groups = filtered.reduce((acc: Record<string, any[]>, r: any) => {
    const key = r.date ? new Date(r.date).toISOString().slice(0, 10) : "unknown";
    (acc[key] ||= []).push(r);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecords = list.filter((r: any) => r.date && new Date(r.date).toISOString().slice(0, 10) === todayStr);
  const presentToday = todayRecords.filter((r: any) => r.status === "present").length;
  const absentToday = todayRecords.filter((r: any) => r.status === "absent").length;
  const monthPresent = list.filter((r: any) => r.status === "present").length;
  const attendanceRate = list.length > 0 ? Math.round((monthPresent / list.length) * 100) : 0;

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!form.employeeId) { setError("Please select an employee."); return; }
    if (!form.date) { setError("Date is required."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to save record"); return; }
      mutate();
      setShowForm(false);
      setForm({ status: "present", date: new Date().toISOString().slice(0, 10), hoursWorked: "" });
    } finally { setLoading(false); }
  }

  async function bulkMark(status: string) {
    const today = new Date().toISOString().slice(0, 10);
    setLoading(true);
    try {
      await Promise.all(
        empList.filter((e: any) => e.isActive).map((emp: any) =>
          fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId: emp.id, date: today, status }) })
        )
      );
      if (month !== currentMonth()) setMonth(currentMonth());
      mutate();
    } finally { setLoading(false); }
  }

  async function updateRecord(id: string, patch: any) {
    const res = await fetch(`/api/attendance/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to update record"); }
    mutate();
  }

  async function deleteRecord(id: string) {
    const res = await fetch(`/api/attendance/${id}`, { method: "DELETE" });
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to delete record"); }
    setConfirmDelete(null);
    mutate();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance</h1>
          <p className="text-sm text-gray-500">{filtered.length} record{filtered.length !== 1 ? "s" : ""} in view</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <ExportButton module="attendance" />
          {canManage && (
            <>
              <button onClick={() => bulkMark("present")} disabled={loading} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700">✓ All Present</button>
              <button onClick={() => bulkMark("absent")} disabled={loading} className="px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-red-600">✗ All Absent</button>
              <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">+ Add Record</button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-700 font-medium">Present Today</p>
          <p className="text-2xl font-bold text-green-800">{presentToday}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-700 font-medium">Absent Today</p>
          <p className="text-2xl font-bold text-red-800">{absentToday}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-700 font-medium">Records This Month</p>
          <p className="text-2xl font-bold text-blue-800">{list.length}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs text-purple-700 font-medium">Attendance Rate</p>
          <p className="text-2xl font-bold text-purple-800">{attendanceRate}%</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex gap-2 flex-wrap">
          {["", "present", "absent", "half_day"].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)} className={"px-3 py-1.5 text-sm rounded-lg capitalize " + (statusFilter === s ? "bg-blue-100 text-blue-700" : "border border-gray-200 text-gray-600 hover:bg-gray-50")}>{s.replace("_", " ") || "All"}</button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap sm:ml-auto">
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All employees</option>
            {empList.filter((e: any) => e.isActive).map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg">Add Attendance Record</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select required value={form.employeeId || ""} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select Employee *</option>
              {empList.filter((e: any) => e.isActive).map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} — {emp.role || ""}</option>)}
            </select>
            <input type="date" required value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <select value={form.status || "present"} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <input type="number" min={0} step={0.5} value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })} placeholder={`Hours (default ${defaultHours(form.status || "present")})`} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="text" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700">{loading ? "Saving…" : "Save Record"}</button>
            <button type="button" onClick={() => { setShowForm(false); setError(""); }} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      )}

      {/* Grouped records */}
      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading records…</div>
      ) : groupKeys.length === 0 ? (
        <div className="text-center py-16 text-gray-400 bg-white border border-gray-200 rounded-xl">
          <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-600">No attendance records for this view</p>
          <p className="text-sm mt-1">Pick another month, or {canManage ? "add today's attendance / use the bulk buttons above." : "check back later."}</p>
        </div>
      ) : (
        <div className="space-y-5">
          {groupKeys.map((dateKey) => {
            const rows = groups[dateKey];
            const p = rows.filter((r: any) => r.status === "present").length;
            const a = rows.filter((r: any) => r.status === "absent").length;
            const h = rows.filter((r: any) => r.status === "half_day").length;
            const dateLabel = new Date(dateKey + "T00:00:00").toLocaleDateString("en-PK", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
            return (
              <div key={dateKey} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <p className="font-semibold text-gray-800 text-sm">{dateLabel}</p>
                  <div className="flex gap-2 text-xs">
                    <span className="text-green-700">{p} present</span>
                    <span className="text-gray-300">·</span>
                    <span className="text-red-600">{a} absent</span>
                    {h > 0 && <><span className="text-gray-300">·</span><span className="text-yellow-700">{h} half-day</span></>}
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs text-gray-500">
                        <th className="text-left py-2 px-4 font-medium">Employee</th>
                        <th className="text-left py-2 px-3 font-medium">Status</th>
                        <th className="text-left py-2 px-3 font-medium w-28">Hours</th>
                        <th className="text-left py-2 px-3 font-medium">Notes</th>
                        {canManage && <th className="text-right py-2 px-4 font-medium w-20">Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r: any) => (
                        <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                          <td className="py-2.5 px-4 font-medium text-gray-900 whitespace-nowrap">{r.employee?.name || "—"}</td>
                          <td className="py-2.5 px-3">
                            {canManage ? (
                              <select
                                value={r.status}
                                onChange={(e) => updateRecord(r.id, { status: e.target.value, hoursWorked: defaultHours(e.target.value) })}
                                className={"text-xs px-2 py-1 rounded-full capitalize border-0 cursor-pointer font-medium " + (STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600")}
                              >
                                {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                              </select>
                            ) : (
                              <span className={"text-xs px-2 py-0.5 rounded-full capitalize " + (STATUS_COLORS[r.status] || "bg-gray-100 text-gray-600")}>{r.status?.replace("_", " ") || "—"}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-600">
                            {canManage ? (
                              <input
                                type="number" min={0} step={0.5}
                                defaultValue={r.hoursWorked ?? 0}
                                key={`${r.id}-${r.hoursWorked}`}
                                onBlur={(e) => { const v = Number(e.target.value); if (v !== (r.hoursWorked ?? 0)) updateRecord(r.id, { hoursWorked: v }); }}
                                className="w-20 border border-gray-200 rounded-md px-2 py-1 text-sm"
                              />
                            ) : (
                              <span>{r.hoursWorked || 0} hrs</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-gray-500">
                            {canManage ? (
                              <input
                                type="text"
                                defaultValue={r.notes || ""}
                                key={`${r.id}-note`}
                                placeholder="Add note…"
                                onBlur={(e) => { if ((e.target.value || "") !== (r.notes || "")) updateRecord(r.id, { notes: e.target.value }); }}
                                className="w-full min-w-[120px] border border-transparent hover:border-gray-200 focus:border-gray-300 rounded-md px-2 py-1 text-sm"
                              />
                            ) : (
                              <span className="text-xs">{r.notes || "—"}</span>
                            )}
                          </td>
                          {canManage && (
                            <td className="py-2.5 px-4 text-right whitespace-nowrap">
                              {confirmDelete === r.id ? (
                                <span className="inline-flex gap-1">
                                  <button onClick={() => deleteRecord(r.id)} className="text-xs px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700">Delete</button>
                                  <button onClick={() => setConfirmDelete(null)} className="text-xs px-2 py-1 border border-gray-200 rounded-md hover:bg-gray-50">No</button>
                                </span>
                              ) : (
                                <button onClick={() => setConfirmDelete(r.id)} className="text-gray-400 hover:text-red-600 text-sm" title="Delete record"><Trash2 className="w-3.5 h-3.5" /></button>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
