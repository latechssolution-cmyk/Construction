"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ExportButton } from "@/components/export-button";
import { Lock, Calendar, Trash2, X, ClipboardList, CheckSquare, Square } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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

// ─── Types ───────────────────────────────────────────────────────────────────
interface BulkRow {
  employeeId: string;
  name: string;
  role: string;
  selected: boolean;
  status: string;
  notes: string;
}

export default function AttendancePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const [month, setMonth] = useState(currentMonth());
  const { data: records, mutate, isLoading } = useSWR(`/api/attendance?month=${month}`, fetcher);
  const { data: employees } = useSWR("/api/employees?limit=500", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);

  // Single-record add form
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ status: "present", date: new Date().toISOString().slice(0, 10), hoursWorked: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Filters
  const [statusFilter, setStatusFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  // Jump straight to one day instead of scrolling through every date group
  // in the month to find it — this was the main complaint: checking the 2nd
  // while today is the 27th meant scrolling past 25 date blocks.
  const [dateFilter, setDateFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // ── Mark Attendance Modal ────────────────────────────────────────────────
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState("");

  if (session && !["admin", "ceo", "manager"].includes(session.user?.role || "")) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="font-medium">Access Restricted</p>
      </div>
    );
  }

  const canManage = ["admin", "ceo", "manager"].includes(session?.user?.role || "");
  const list: any[] = Array.isArray(records) ? records : [];
  const empList: any[] = employees?.data ? employees.data : (Array.isArray(employees) ? employees : []);
  const activeEmps = empList.filter((e: any) => e.isActive !== false);

  const filtered = list.filter((r: any) => {
    if (statusFilter && r.status !== statusFilter) return false;
    if (employeeFilter && r.employee?.id !== employeeFilter) return false;
    if (dateFilter && r.date && new Date(r.date).toISOString().slice(0, 10) !== dateFilter) return false;
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

  // ── Single-record submit ────────────────────────────────────────────────
  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!form.employeeId) { setError("Please select an employee."); return; }
    if (!form.date) { setError("Date is required."); return; }
    if (new Date(form.date) > new Date()) { setError("Date cannot be in the future."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Failed to save record"); return; }
      mutate();
      setShowForm(false);
      setForm({ status: "present", date: new Date().toISOString().slice(0, 10), hoursWorked: "" });
    } finally { setLoading(false); }
  }

  // ── Bulk modal open ─────────────────────────────────────────────────────
  function openBulkModal() {
    const rows: BulkRow[] = activeEmps.map((emp: any) => ({
      employeeId: emp.id,
      name: emp.name,
      role: emp.role || emp.designation || "",
      selected: true,
      status: "present",
      notes: "",
    }));
    setBulkRows(rows);
    setBulkDate(new Date().toISOString().slice(0, 10));
    setBulkError("");
    setShowBulkModal(true);
  }

  function updateBulkRow(idx: number, field: keyof BulkRow, value: any) {
    setBulkRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  }

  function selectAll(val: boolean) {
    setBulkRows(prev => prev.map(r => ({ ...r, selected: val })));
  }

  function setAllStatus(status: string) {
    setBulkRows(prev => prev.map(r => r.selected ? { ...r, status } : r));
  }

  async function submitBulkAttendance() {
    const selected = bulkRows.filter(r => r.selected);
    if (selected.length === 0) { setBulkError("Select at least one employee."); return; }
    if (!bulkDate) { setBulkError("Date is required."); return; }
    if (new Date(bulkDate) > new Date()) { setBulkError("Date cannot be in the future."); return; }
    setBulkLoading(true);
    setBulkError("");
    try {
      const payload = selected.map(row => ({
        employeeId: row.employeeId,
        date: bulkDate,
        status: row.status,
        hoursWorked: defaultHours(row.status),
        notes: row.notes.trim() || undefined,
      }));
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        setBulkError(e.error || "Failed to submit attendance records.");
      } else {
        setShowBulkModal(false);
        if (month !== currentMonth()) setMonth(currentMonth());
        mutate();
        toast({ title: "Attendance recorded", description: `Successfully submitted ${selected.length} records.` });
      }
    } catch {
      setBulkError("Network error. Please try again.");
    } finally {
      setBulkLoading(false);
    }
  }

  async function updateRecord(id: string, patch: any) {
    setError("");
    try {
      const res = await fetch(`/api/attendance/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast({ title: "Error", description: e.error || "Failed to update record", variant: "destructive" });
        setError(e.error || "Failed to update record");
      } else {
        toast({ title: "Record updated successfully" });
      }
    } catch {
      toast({ title: "Error", description: "Network error. Failed to update record.", variant: "destructive" });
    } finally {
      mutate();
    }
  }

  async function deleteRecord(id: string) {
    setError("");
    try {
      const res = await fetch(`/api/attendance/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast({ title: "Error", description: e.error || "Failed to delete record", variant: "destructive" });
        setError(e.error || "Failed to delete record");
      } else {
        toast({ title: "Record deleted successfully" });
      }
    } catch {
      toast({ title: "Error", description: "Network error. Failed to delete record.", variant: "destructive" });
    } finally {
      setConfirmDelete(null);
      mutate();
    }
  }

  const allSelected = bulkRows.length > 0 && bulkRows.every(r => r.selected);
  const someSelected = bulkRows.some(r => r.selected);

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
              <button
                onClick={openBulkModal}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5"
              >
                <ClipboardList className="w-4 h-4" /> Mark Attendance
              </button>
              <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700">
                + Add Record
              </button>
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
        <div className="flex gap-2 flex-wrap sm:ml-auto items-center">
          <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
            <option value="">All employees</option>
            {activeEmps.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          {/* Jump to a specific day — replaces scrolling through the whole month */}
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={dateFilter}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => {
                const v = e.target.value;
                setDateFilter(v);
                if (v) setMonth(v.slice(0, 7));
              }}
              className={`border rounded-lg px-3 py-2 text-sm ${dateFilter ? "border-blue-400 bg-blue-50" : "border-gray-200"}`}
              title="Jump to a specific date"
            />
            {dateFilter && (
              <button onClick={() => setDateFilter("")} className="text-gray-400 hover:text-gray-600 p-1" title="Clear date filter">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          {!dateFilter && (
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value || currentMonth())} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          )}
          <button
            onClick={() => { const t = new Date().toISOString().slice(0, 10); setDateFilter(t); setMonth(t.slice(0, 7)); }}
            className="text-xs px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
          >
            Today
          </button>
        </div>
      </div>

      {/* Single-record add form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg">Add Attendance Record</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select required value={form.employeeId || ""} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">Select Employee *</option>
              {activeEmps.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} — {emp.role || ""}</option>)}
            </select>
            <input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <select value={form.status || "present"} onChange={(e) => setForm({ ...form, status: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <input type="number" min={0} step={0.5} value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: e.target.value })} placeholder={`Hours (default ${defaultHours(form.status || "present")})`} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <select value={form.projectId || ""} onChange={(e) => setForm({ ...form, projectId: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
              <option value="">No project (general)</option>
              {(Array.isArray(projects) ? projects : []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
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
          <p className="font-medium text-gray-600">
            {dateFilter ? `No attendance records for ${new Date(dateFilter + "T00:00:00").toLocaleDateString("en-PK", { weekday: "long", month: "long", day: "numeric" })}` : "No attendance records for this view"}
          </p>
          <p className="text-sm mt-1">
            {dateFilter ? "Try clearing the date filter or picking another day." : `Pick another month, or ${canManage ? 'use "Mark Attendance" to record today\'s attendance.' : "check back later."}`}
          </p>
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
                        <th className="text-left py-2 px-3 font-medium">Notes / Reason</th>
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
                                placeholder="Add note / reason…"
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

      {/* ── Mark Attendance Modal ──────────────────────────────────────────── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-12 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div>
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-indigo-600" /> Mark Attendance
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{activeEmps.length} active employee{activeEmps.length !== 1 ? "s" : ""} · select employees and set their status</p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600 p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Date + Quick-action bar */}
            <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-gray-600">Date</label>
                <input
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={bulkDate}
                  onChange={e => setBulkDate(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
                />
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                {/* Select all / none */}
                <button
                  type="button"
                  onClick={() => selectAll(!allSelected)}
                  className="flex items-center gap-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
                >
                  {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5" />}
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
                {/* Quick-set status for selected */}
                {someSelected && (
                  <>
                    <span className="text-xs text-gray-400">Set selected:</span>
                    <button type="button" onClick={() => setAllStatus("present")} className="text-xs px-2.5 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium">✓ All Present</button>
                    <button type="button" onClick={() => setAllStatus("absent")} className="text-xs px-2.5 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium">✗ All Absent</button>
                    <button type="button" onClick={() => setAllStatus("half_day")} className="text-xs px-2.5 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 font-medium">½ Half Day</button>
                  </>
                )}
              </div>
            </div>

            {/* Employee list */}
            <div className="overflow-y-auto max-h-[50vh]">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 z-10">
                  <tr>
                    <th className="py-2.5 px-4 text-left text-xs font-medium text-gray-500 w-10">
                      <button onClick={() => selectAll(!allSelected)} className="p-0.5">
                        {allSelected ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                      </button>
                    </th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500">Employee</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500 w-36">Status</th>
                    <th className="py-2.5 px-3 text-left text-xs font-medium text-gray-500">Notes / Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {bulkRows.map((row, idx) => (
                    <tr
                      key={row.employeeId}
                      className={"border-b border-gray-50 last:border-0 transition-colors " + (row.selected ? "bg-white hover:bg-indigo-50/30" : "bg-gray-50/60 opacity-60")}
                    >
                      <td className="py-2.5 px-4">
                        <button onClick={() => updateBulkRow(idx, "selected", !row.selected)} className="p-0.5">
                          {row.selected
                            ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                            : <Square className="w-4 h-4 text-gray-400" />
                          }
                        </button>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="font-medium text-gray-900">{row.name}</p>
                        {row.role && <p className="text-xs text-gray-400 capitalize">{row.role}</p>}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          {[
                            { value: "present", label: "P", title: "Present", colorActive: "bg-green-600 text-white border-green-600 shadow-sm", colorInactive: "bg-green-50/50 hover:bg-green-100 text-green-700 border-green-200" },
                            { value: "absent", label: "A", title: "Absent", colorActive: "bg-red-600 text-white border-red-600 shadow-sm", colorInactive: "bg-red-50/50 hover:bg-red-100 text-red-700 border-red-200" },
                            { value: "half_day", label: "H", title: "Half Day", colorActive: "bg-yellow-500 text-white border-yellow-500 shadow-sm", colorInactive: "bg-yellow-50/50 hover:bg-yellow-100 text-yellow-700 border-yellow-250" },
                          ].map(btn => {
                            const active = row.status === btn.value;
                            return (
                              <button
                                key={btn.value}
                                type="button"
                                disabled={!row.selected}
                                title={btn.title}
                                onClick={() => updateBulkRow(idx, "status", btn.value)}
                                className={`w-7 h-7 rounded-full border text-[10px] font-bold transition-all flex items-center justify-center disabled:opacity-30 ${active ? btn.colorActive : btn.colorInactive}`}
                              >
                                {btn.label}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={e => updateBulkRow(idx, "notes", e.target.value)}
                          disabled={!row.selected}
                          placeholder="Reason, notes… (optional)"
                          className="w-full text-sm border border-transparent hover:border-gray-200 focus:border-gray-300 focus:outline-none rounded-md px-2 py-1 disabled:opacity-40"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activeEmps.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <p className="text-sm">No active employees found.</p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            {bulkError && <div className="mx-6 mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{bulkError}</div>}
            <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-gray-500">
                {bulkRows.filter(r => r.selected).length} of {bulkRows.length} employee{bulkRows.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex gap-2">
                <button onClick={() => setShowBulkModal(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={submitBulkAttendance}
                  disabled={bulkLoading || !someSelected}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {bulkLoading ? "Saving…" : `Submit Attendance (${bulkRows.filter(r => r.selected).length})`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
