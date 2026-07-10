"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Trash2, Pencil, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const STATUSES = ["todo", "in_progress", "on_hold", "completed"];
const STATUS_LABELS: Record<string, string> = { todo: "To Do", in_progress: "In Progress", on_hold: "On Hold", completed: "Completed" };
const STATUS_COLORS: Record<string, string> = { todo: "bg-gray-100 text-gray-700", in_progress: "bg-blue-100 text-blue-700", on_hold: "bg-yellow-100 text-yellow-700", completed: "bg-green-100 text-green-700" };
const PRIORITIES = ["low", "medium", "high", "critical"];
const PRIORITY_COLORS: Record<string, string> = { low: "bg-gray-100 text-gray-600", medium: "bg-blue-100 text-blue-600", high: "bg-orange-100 text-orange-600", critical: "bg-red-100 text-red-600" };

export default function TasksPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: tasks, mutate, isLoading } = useSWR("/api/tasks", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const { data: users } = useSWR("/api/users/assignable", fetcher);

  const [projectFilter, setProjectFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const q = params.get("q");
      if (q) setSearch(q);
      if (params.get("overdue") === "1") { setOverdueOnly(true); setView("list"); }
    }
  }, []);

  const [showForm, setShowForm] = useState(false);
  // Initial weight defaults to 1 (Issue #44)
  const [form, setForm] = useState<any>({ status: "todo", priority: "medium", weight: 1 });
  const [loading, setLoading] = useState(false);

  // Edit states
  const [editingTask, setEditingTask] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);

  // Confirm delete dialog state (Issue #45)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const canCreate = ["admin", "ceo", "manager"].includes(session?.user?.role || "");
  const canDelete = ["admin", "manager"].includes(session?.user?.role || "");

  const list: any[] = Array.isArray(tasks) ? tasks : [];
  const filtered = list.filter((t: any) => {
    const matchesSearch = !search ||
      t.title?.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase());
    const isOverdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed";
    return (
      matchesSearch &&
      (!projectFilter || t.projectId === projectFilter) &&
      (!priorityFilter || t.priority === priorityFilter) &&
      (!statusFilter || t.status === statusFilter) &&
      (!overdueOnly || isOverdue)
    );
  });

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (form.estimatedHours && parseFloat(form.estimatedHours) < 0) {
      toast({ title: "Validation Error", description: "Estimated hours cannot be negative.", variant: "destructive" });
      return;
    }
    if (form.weight && parseFloat(form.weight) < 0) {
      toast({ title: "Validation Error", description: "Task weight cannot be negative.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json();
        toast({ title: "Error", description: e.error || "Failed to create task", variant: "destructive" });
        return;
      }
      toast({ title: "Task created" });
      mutate();
      setShowForm(false);
      setForm({ status: "todo", priority: "medium", weight: 1 });
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(id: string, status: string) {
    // Optimistic update — flip the status in the local cache immediately so
    // the kanban/list UI responds on click instead of waiting for the full
    // (up to 500-row, 3x populated) task list to re-fetch.
    mutate((current: any) => {
      const list = Array.isArray(current) ? current : [];
      return list.map((t: any) => (t.id === id ? { ...t, status } : t));
    }, { revalidate: false });

    const res = await fetch(`/api/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast({ title: "Error", description: e.error || "Failed to update task", variant: "destructive" });
      mutate();
      return;
    }
    mutate();
  }

  function startEdit(t: any) {
    setEditingTask(t);
    setEditForm({
      title: t.title,
      description: t.description || "",
      projectId: t.projectId || "",
      phaseId: t.phaseId || "",
      assignedToId: t.assignedToId || "",
      priority: t.priority || "medium",
      status: t.status,
      dueDate: t.dueDate ? new Date(t.dueDate).toISOString().slice(0, 10) : "",
      estimatedHours: t.estimatedHours || "",
      notes: t.notes || "",
      weight: t.weight || 1, // Store weight in editForm
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editForm.estimatedHours && parseFloat(editForm.estimatedHours) < 0) {
      toast({ title: "Validation Error", description: "Estimated hours cannot be negative.", variant: "destructive" });
      return;
    }
    if (editForm.weight && parseFloat(editForm.weight) < 0) {
      toast({ title: "Validation Error", description: "Task weight cannot be negative.", variant: "destructive" });
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/tasks/${editingTask.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to update task", variant: "destructive" });
        return;
      }
      toast({ title: "Task updated", description: "The task details have been saved." });
      mutate();
      setEditingTask(null);
      setEditForm({});
    } finally {
      setEditLoading(false);
    }
  }

  async function executeDelete(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast({ title: "Error", description: e.error || "Failed to delete task", variant: "destructive" });
      return;
    }
    toast({ title: "Task deleted" });
    mutate();
    setDeleteConfirmId(null);
  }

  const byStatus = (s: string) => filtered.filter((t: any) => t.status === s);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Tasks"
        subtitle={`${filtered.length} task${filtered.length !== 1 ? "s" : ""}`}
        actions={<>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            <button onClick={() => setView("kanban")} className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${view === "kanban" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>Kanban</button>
            <button onClick={() => setView("list")} className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${view === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>List</button>
          </div>
          {canCreate && (
            <button
              onClick={() => { setShowForm(!showForm); setEditingTask(null); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 shadow-sm"
            >
              {showForm ? "Cancel" : "+ Add Task"}
            </button>
          )}
        </>}
      />

      <div className="flex gap-3 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Projects</option>
          {(Array.isArray(projects) ? projects : []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        {overdueOnly && (
          <button
            type="button"
            onClick={() => setOverdueOnly(false)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200"
          >
            Overdue only
            <span className="text-red-400 hover:text-red-600">×</span>
          </button>
        )}
      </div>

      {/* New Task Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">New Task</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.title || ""} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Task Title *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <textarea value={form.description || ""} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description" rows={2} className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select required value={form.projectId || ""} onChange={e => setForm({ ...form, projectId: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Project *</option>
              {(Array.isArray(projects) ? projects : []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.assignedToId || ""} onChange={e => setForm({ ...form, assignedToId: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Assign To (optional)</option>
              {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
            <select value={form.priority || "medium"} onChange={e => setForm({ ...form, priority: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <select value={form.status || "todo"} onChange={e => setForm({ ...form, status: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <input type="date" value={form.dueDate || ""} onChange={e => setForm({ ...form, dueDate: e.target.value })} placeholder="Due Date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="number" min="0" step="0.5" value={form.estimatedHours || ""} onChange={e => setForm({ ...form, estimatedHours: e.target.value })} placeholder="Estimated Hours" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            
            {/* Weight input field (Issue #44) */}
            <div className="flex flex-col sm:col-span-2">
              <label className="text-xs text-gray-500 font-medium mb-1">Task Weight (for project progress completion calculation)</label>
              <input type="number" min="1" step="1" required value={form.weight ?? 1} onChange={e => setForm({ ...form, weight: parseInt(e.target.value) || 1 })} placeholder="Task Weight" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading ? "Saving..." : "Create Task"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Edit Task Modal/Form */}
      {editingTask && (
        <form onSubmit={handleEditSubmit} className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-blue-900">Edit Task: {editingTask.title}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={editForm.title || ""} onChange={e => setEditForm({ ...editForm, title: e.target.value })} placeholder="Task Title *" className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <textarea value={editForm.description || ""} onChange={e => setEditForm({ ...editForm, description: e.target.value })} placeholder="Description" rows={2} className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select required value={editForm.projectId || ""} onChange={e => setEditForm({ ...editForm, projectId: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Project *</option>
              {(Array.isArray(projects) ? projects : []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={editForm.assignedToId || ""} onChange={e => setEditForm({ ...editForm, assignedToId: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Assign To (optional)</option>
              {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
            <select value={editForm.priority || "medium"} onChange={e => setEditForm({ ...editForm, priority: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {PRIORITIES.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <select value={editForm.status || "todo"} onChange={e => setEditForm({ ...editForm, status: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <input type="date" value={editForm.dueDate || ""} onChange={e => setEditForm({ ...editForm, dueDate: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="number" min="0" step="0.5" value={editForm.estimatedHours || ""} onChange={e => setEditForm({ ...editForm, estimatedHours: e.target.value })} placeholder="Estimated Hours" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            
            {/* Weight input field (Issue #44) */}
            <div className="flex flex-col sm:col-span-2">
              <label className="text-xs text-blue-900 font-medium mb-1">Task Weight (for progress calculation)</label>
              <input type="number" min="1" step="1" required value={editForm.weight ?? 1} onChange={e => setEditForm({ ...editForm, weight: parseInt(e.target.value) || 1 })} placeholder="Task Weight" className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>

            <input type="text" value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Activity Notes / Progress Report" className="border border-gray-300 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={editLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">{editLoading ? "Saving..." : "Save Changes"}</button>
            <button type="button" onClick={() => { setEditingTask(null); setEditForm({}); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* View Content */}
      {isLoading ? (
        <TableSkeleton />
      ) : view === "kanban" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUSES.map(status => (
            <div key={status} className="bg-gray-50 rounded-xl p-3 space-y-3 min-h-[300px]">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
                <span className="text-xs text-gray-400 font-bold">{byStatus(status).length}</span>
              </div>
              {byStatus(status).map((t: any) => (
                <div key={t.id} className="bg-white rounded-lg p-3.5 shadow-sm space-y-2 border border-gray-100 hover:shadow-md transition-all">
                  <div className="flex items-start justify-between gap-1.5">
                    <p className="text-sm font-semibold text-gray-900 flex-1 leading-snug">{t.title}</p>
                    <div className="flex gap-1 items-center shrink-0">
                      {canCreate && (
                        <button onClick={() => startEdit(t)} className="text-gray-400 hover:text-blue-600 p-0.5" title="Edit task">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => setDeleteConfirmId(t.id)} className="text-gray-400 hover:text-red-600 p-0.5" title="Delete task">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  {t.description && <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">{t.description}</p>}
                  {t.project && (
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-xs text-blue-600 font-semibold">{t.project.name}</p>
                      {t.weight && <span className="text-[10px] bg-blue-50 text-blue-600 px-1 py-0.2 rounded">Wt: {t.weight}</span>}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-1 pt-1">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${PRIORITY_COLORS[t.priority || "medium"]}`}>{t.priority || "medium"}</span>
                    {t.dueDate && <span className={`text-xs ${new Date(t.dueDate) < new Date() && t.status !== "completed" ? "text-red-500 font-medium" : "text-gray-400"}`}>{new Date(t.dueDate).toLocaleDateString()}</span>}
                  </div>
                  {t.assignedTo && <p className="text-xs text-gray-500 font-medium mt-1">👤 {t.assignedTo.name}</p>}
                </div>
              ))}
              {byStatus(status).length === 0 && <p className="text-xs text-gray-300 text-center py-6">No tasks</p>}
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<ClipboardList className="w-10 h-10" />} title="No tasks found" hint='Tasks help you track work on a project. Click "+ Add Task" to create the first one.' />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Title", "Project", "Weight", "Assigned To", "Priority", "Status", "Due Date", "Actions"].map(h => (
                    <th key={h} className="text-left py-3 px-4 text-xs text-gray-500 font-semibold uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t: any) => (
                  <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-semibold text-gray-900">{t.title}</td>
                    <td className="py-3 px-4 text-gray-600 font-medium">{t.project?.name || "—"}</td>
                    <td className="py-3 px-4 text-gray-600">{t.weight || 1}</td>
                    <td className="py-3 px-4 text-gray-500">{t.assignedTo?.name || "Unassigned"}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority || "medium"]}`}>{t.priority || "medium"}</span></td>
                    <td className="py-3 px-4">
                      {canCreate ? (
                        <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} className="text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-white cursor-pointer font-medium">
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                        </select>
                      ) : (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                      )}
                    </td>
                    <td className={`py-3 px-4 text-sm whitespace-nowrap font-medium ${t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed" ? "text-red-500" : "text-gray-500"}`}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        {canCreate && <button onClick={() => startEdit(t)} className="text-xs text-blue-500 hover:text-blue-700 hover:underline">Edit</button>}
                        {canDelete && <button onClick={() => setDeleteConfirmId(t.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline">Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((t: any) => (
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500">{t.project?.name || "—"} (Weight: {t.weight || 1})</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[t.priority || "medium"]}`}>{t.priority || "medium"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 text-xs">
                  <div><span className="text-gray-400">Assigned: </span><span className="text-gray-700 font-medium">{t.assignedTo?.name || "Unassigned"}</span></div>
                  <div><span className="text-gray-400">Due: </span><span className={`whitespace-nowrap font-medium ${t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "completed" ? "text-red-500" : "text-gray-700"}`}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString() : "—"}</span></div>
                </div>
                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                  {canCreate ? (
                    <select value={t.status} onChange={e => updateStatus(t.id, e.target.value)} className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white cursor-pointer font-medium">
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                  )}
                  <div className="flex gap-2">
                    {canCreate && <button onClick={() => startEdit(t)} className="text-xs text-blue-500 hover:text-blue-700 hover:underline">Edit</button>}
                    {canDelete && <button onClick={() => setDeleteConfirmId(t.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline">Delete</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* React Confirm Dialog Overlay (Issue #45) */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4 border border-gray-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="bg-red-100 p-2 rounded-full">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold">Delete Task?</h3>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              Are you sure you want to permanently delete this task? This action cannot be undone and will affect project progress calculations.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeDelete(deleteConfirmId)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
