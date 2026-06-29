"use client";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, X, Download, FileText, BarChart2, Boxes, Wallet, HardHat, FolderOpen, Users } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PROJECT_STATUSES = ["planning", "in_progress", "on_hold", "completed", "cancelled"];
const PROJECT_TYPES = ["residential", "commercial", "industrial", "renovation", "infrastructure", "other"];

const TABS = ["Overview", "Phases & Tasks", "Materials", "Team", "Finance", "Documents", "Milestones", "Report"];
const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700", in_progress: "bg-blue-100 text-blue-800", on_hold: "bg-yellow-100 text-yellow-800", completed: "bg-green-100 text-green-800",
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { toast } = useToast();
  const role = session?.user?.role || "";
  const canManage = ["admin", "ceo", "manager"].includes(role);

  const [tab, setTab] = useState("Overview");
  const [taskForm, setTaskForm] = useState<any>({});
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState<any>({});
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [materialForm, setMaterialForm] = useState<any>({});
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editMaterialForm, setEditMaterialForm] = useState<any>({});
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);

  // Inline editing of project details
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<any>({});

  const { data: project, mutate } = useSWR(`/api/projects/${id}`, fetcher);
  const { data: summary, mutate: mutateSummary } = useSWR(`/api/projects/${id}/summary`, fetcher);
  const { data: vendors } = useSWR("/api/vendors", fetcher);
  const { data: clients } = useSWR(canManage ? "/api/clients" : null, fetcher);
  const { data: managers } = useSWR(canManage ? "/api/users/assignable" : null, fetcher);

  // Seed the edit form whenever we enter edit mode / project loads
  useEffect(() => {
    if (project && !project.error) {
      setEdit({
        name: project.name ?? "",
        status: project.status ?? "planning",
        type: project.type ?? "residential",
        location: project.location ?? "",
        budget: project.budget ?? 0,
        completionPercent: Math.round(project.completionPercent ?? 0),
        startDate: project.startDate ? project.startDate.slice(0, 10) : "",
        endDate: project.endDate ? project.endDate.slice(0, 10) : "",
        clientId: project.clientId ?? "",
        assignedManagerId: project.assignedManagerId ?? "",
        description: project.description ?? "",
      });
    }
  }, [project?.id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return <div className="p-6 text-gray-500">Loading project...</div>;
  if (project.error) return <div className="p-6 text-red-500">Project not found</div>;

  async function saveProject(extra?: any) {
    setSaving(true);
    try {
      const payload = extra ?? edit;
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: err.error || "Failed to save changes", variant: "destructive" });
        return;
      }
      await mutate();
      await mutateSummary();
      if (!extra) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  // Quick-save just the completion percentage (used by the progress slider)
  async function saveCompletion(pct: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(pct)));
    await saveProject({ completionPercent: clamped });
  }

  const income = (project.ledgerEntries || []).filter((e: any) => e.type === "income").reduce((s: number, e: any) => s + e.amount, 0);
  const expense = (project.ledgerEntries || []).filter((e: any) => e.type === "expense").reduce((s: number, e: any) => s + e.amount, 0);

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskForm),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to create task", variant: "destructive" }); return; }
    mutate();
    setShowTaskForm(false);
    setTaskForm({});
  }

  async function updateTask(taskId: string, updates: any) {
    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to update task", variant: "destructive" }); return; }
    mutate();
  }

  async function createMilestone(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(milestoneForm),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to create milestone", variant: "destructive" }); return; }
    mutate();
    setShowMilestoneForm(false);
    setMilestoneForm({});
  }

  async function toggleMilestone(m: any) {
    const res = await fetch(`/api/milestones/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...m, completed: !m.completedAt }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to update milestone", variant: "destructive" }); return; }
    mutate();
  }

  async function createMaterial(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...materialForm, projectId: id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to add material", variant: "destructive" });
      return;
    }
    mutate();
    setShowMaterialForm(false);
    setMaterialForm({});
    toast({ title: "Material added" });
  }

  async function deleteMaterial(materialId: string) {
    const res = await fetch(`/api/materials/${materialId}`, { method: "DELETE" });
    if (res.ok) {
      mutate();
      setDeletingMaterialId(null);
      toast({ title: "Material removed" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to delete material", variant: "destructive" });
    }
  }

  async function updateMaterial(e: React.FormEvent, materialId: string) {
    e.preventDefault();
    const res = await fetch(`/api/materials/${materialId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editMaterialForm),
    });
    if (res.ok) {
      mutate();
      setEditingMaterialId(null);
      setEditMaterialForm({});
      toast({ title: "Material updated" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to update material", variant: "destructive" });
    }
  }

  async function downloadReport() {
    const res = await fetch(`/api/projects/${id}/report`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to generate report", variant: "destructive" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-report-${project.name}.pdf`;
    a.click();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/projects" className="hover:text-blue-600">Projects</Link>
            <span>/</span>
            <span className="text-gray-900">{project.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{project.location} · {project.type} · {project.client?.name}</p>
        </div>
        <div className="flex gap-2">
          {canManage && !editing && (
            <button onClick={() => { setEditing(true); setTab("Overview"); }} className="px-3 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm hover:bg-blue-50">
              <span className="flex items-center gap-1.5"><Pencil className="w-4 h-4" /> Edit Project</span>
            </button>
          )}
          {canManage && editing && (
            <>
              <button onClick={() => saveProject()} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditing(false)} className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </>
          )}
          <button onClick={downloadReport} className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            <span className="flex items-center gap-1.5"><Download className="w-4 h-4" /> Download Report</span>
          </button>
          <span className={`px-3 py-2 rounded-lg text-sm font-medium ${project.status === "in_progress" ? "bg-blue-100 text-blue-800" : project.status === "completed" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
            {project.status?.replace("_", " ").toUpperCase()}
          </span>
        </div>
      </div>

      {/* Completion progress — editable */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Overall Completion</h3>
            <p className="text-xs text-gray-400">
              Manually tracked progress
              {summary && typeof summary.taskProgress === "number" ? ` · Tasks auto: ${summary.taskProgress}% (${summary.completedTasks}/${summary.totalTasks})` : ""}
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-600">{Math.round(project.completionPercent || 0)}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${(project.completionPercent || 0) >= 100 ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(project.completionPercent || 0, 100)}%` }}
          />
        </div>
        {canManage && (
          <div className="mt-4 flex items-center gap-3">
            <input
              type="range" min={0} max={100} step={5}
              defaultValue={Math.round(project.completionPercent || 0)}
              key={Math.round(project.completionPercent || 0)}
              onPointerUp={(e) => saveCompletion(Number((e.target as HTMLInputElement).value))}
              disabled={saving}
              className="flex-1 accent-blue-600 cursor-pointer"
            />
            <div className="flex items-center gap-1">
              <input
                type="number" min={0} max={100}
                defaultValue={Math.round(project.completionPercent || 0)}
                key={Math.round(project.completionPercent || 0)}
                onBlur={(e) => { const v = Number(e.target.value); if (v !== Math.round(project.completionPercent || 0)) saveCompletion(v); }}
                onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1 text-sm text-right"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
            <div className="flex gap-1">
              {[25, 50, 75, 100].map((q) => (
                <button key={q} onClick={() => saveCompletion(q)} disabled={saving}
                  className="text-xs px-2 py-1 border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50">{q}%</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Budget", value: `PKR ${summary.budget?.toLocaleString()}`, sub: `${summary.budgetUsedPct || 0}% used`, color: (summary.budgetUsedPct || 0) > 90 ? "text-red-600" : "text-green-600" },
            { label: "Net Profit", value: `PKR ${(summary.profit || 0).toLocaleString()}`, sub: `Inc: ${summary.income?.toLocaleString()}`, color: (summary.profit || 0) >= 0 ? "text-green-600" : "text-red-600" },
            { label: "Task Progress", value: `${summary.taskProgress || 0}%`, sub: `${summary.completedTasks}/${summary.totalTasks} done` },
            { label: "Milestones", value: `${summary.milestoneProgress || 0}%`, sub: `${summary.completedMilestones}/${summary.totalMilestones} complete` },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-lg font-bold ${card.color || "text-gray-900"}`}>{card.value}</p>
              <p className="text-xs text-gray-400">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Project Details</h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Project Name</label>
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                    <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                    <input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Budget (PKR)</label>
                    <input type="number" value={edit.budget} onChange={(e) => setEdit({ ...edit, budget: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                    <input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                    <input type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                    <select value={edit.clientId} onChange={(e) => setEdit({ ...edit, clientId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">— None —</option>
                      {(Array.isArray(clients) ? clients : []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Manager</label>
                    <select value={edit.assignedManagerId} onChange={(e) => setEdit({ ...edit, assignedManagerId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">— Unassigned —</option>
                      {(Array.isArray(managers) ? managers : []).filter((m: any) => ["manager", "admin", "ceo"].includes(m.role)).map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            ) : (
              <>
                {[
                  ["Client", project.client?.name],
                  ["Manager", project.assignedManager?.name],
                  ["Type", project.type],
                  ["Start Date", project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"],
                  ["End Date", project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"],
                  ["Contract", project.contract?.contractNumber],
                  ["Budget", `PKR ${(project.budget || 0).toLocaleString()}`],
                  ["Completion", `${Math.round(project.completionPercent || 0)}%`],
                ].map(([l, v]) => v && (
                  <div key={l} className="flex justify-between text-sm">
                    <span className="text-gray-500">{l}</span>
                    <span className="font-medium text-gray-900">{v}</span>
                  </div>
                ))}
                {project.description && <p className="text-sm text-gray-600 mt-3 pt-3 border-t">{project.description}</p>}
              </>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Financial Summary</h3>
            <div className="space-y-3">
              {[
                ["Total Income", income, "text-green-600"],
                ["Total Expense", expense, "text-red-600"],
                ["Net Profit", income - expense, income - expense >= 0 ? "text-green-600" : "text-red-600"],
                ["Budget Remaining", (project.budget || 0) - expense, (project.budget || 0) - expense >= 0 ? "text-blue-600" : "text-red-600"],
              ].map(([l, v, c]: any) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-gray-500">{l}</span>
                  <span className={`font-bold ${c}`}>PKR {v.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === "Phases & Tasks" && (
        <div className="space-y-4">
          <div className="flex justify-between">
            <h3 className="font-semibold text-gray-900">Tasks ({(project.tasks || []).length})</h3>
            <button onClick={() => setShowTaskForm(!showTaskForm)} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">+ Add Task</button>
          </div>
          {showTaskForm && (
            <form onSubmit={createTask} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2"><input required value={taskForm.title || ""} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} placeholder="Task title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                <select value={taskForm.priority || "medium"} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                </select>
                <input type="date" value={taskForm.dueDate || ""} onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <div className="col-span-2"><textarea value={taskForm.description || ""} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} placeholder="Description" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Create</button>
                <button type="button" onClick={() => setShowTaskForm(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          )}
          <div className="space-y-2">
            {(project.tasks || []).map((task: any) => (
              <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <input type="checkbox" checked={task.status === "completed"} onChange={() => updateTask(task.id, { ...task, status: task.status === "completed" ? "todo" : "completed" })} className="w-4 h-4 accent-blue-600" />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-gray-400" : "text-gray-900"}`}>{task.title}</p>
                  {task.assignedTo && <p className="text-xs text-gray-500">{task.assignedTo.name}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {task.dueDate && <span className="text-xs text-gray-400">{new Date(task.dueDate).toLocaleDateString()}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status] || ""}`}>{task.status?.replace("_"," ")}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${task.priority === "high" ? "bg-red-100 text-red-700" : task.priority === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{task.priority}</span>
                </div>
              </div>
            ))}
            {(project.tasks || []).length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No tasks yet</p>}
          </div>
        </div>
      )}

      {tab === "Milestones" && (
        <div className="space-y-4">
          <div className="flex justify-between">
            <h3 className="font-semibold text-gray-900">Milestones</h3>
            <button onClick={() => setShowMilestoneForm(!showMilestoneForm)} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">+ Add Milestone</button>
          </div>
          {showMilestoneForm && (
            <form onSubmit={createMilestone} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <input required value={milestoneForm.name || ""} onChange={(e) => setMilestoneForm({...milestoneForm, name: e.target.value})} placeholder="Milestone name *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={milestoneForm.dueDate || ""} onChange={(e) => setMilestoneForm({...milestoneForm, dueDate: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Create</button>
                <button type="button" onClick={() => setShowMilestoneForm(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          )}
          <div className="space-y-3">
            {(project.milestones || []).map((m: any) => (
              <div key={m.id} className={`bg-white border rounded-xl p-4 flex items-center gap-3 ${m.completedAt ? "border-green-200" : "border-gray-200"}`}>
                <button onClick={() => toggleMilestone(m)} className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${m.completedAt ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"}`}>
                  {m.completedAt && "✓"}
                </button>
                <div className="flex-1">
                  <p className={`font-medium text-sm ${m.completedAt ? "text-green-800" : "text-gray-900"}`}>{m.name}</p>
                </div>
                <div className="text-right">
                  {m.dueDate && <p className="text-xs text-gray-400">Due: {new Date(m.dueDate).toLocaleDateString()}</p>}
                  {m.completedAt && <p className="text-xs text-green-600">✓ {new Date(m.completedAt).toLocaleDateString()}</p>}
                </div>
              </div>
            ))}
            {(project.milestones || []).length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No milestones yet</p>}
          </div>
        </div>
      )}

      {tab === "Materials" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Materials / Stock</h3>
            {canManage && (
              <button
                onClick={() => { setShowMaterialForm(!showMaterialForm); setEditingMaterialId(null); }}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg"
              >+ Add Material</button>
            )}
          </div>
          {showMaterialForm && (
            <form onSubmit={createMaterial} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">New Material</h4>
              <div className="grid grid-cols-2 gap-3">
                <input required value={materialForm.itemName || ""} onChange={(e) => setMaterialForm({...materialForm, itemName: e.target.value})} placeholder="Item name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <select value={materialForm.category || "general"} onChange={(e) => setMaterialForm({...materialForm, category: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="masonry">Masonry</option><option value="steel">Steel</option><option value="binding">Cement/Binding</option>
                  <option value="aggregate">Aggregate</option><option value="tiles">Tiles</option><option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option><option value="paint">Paint</option><option value="general">General</option>
                </select>
                <input required type="number" value={materialForm.quantity || ""} onChange={(e) => setMaterialForm({...materialForm, quantity: e.target.value})} placeholder="Quantity *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input required value={materialForm.unit || ""} onChange={(e) => setMaterialForm({...materialForm, unit: e.target.value})} placeholder="Unit (bags, kg, pcs)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input required type="number" step="0.01" value={materialForm.unitPrice || ""} onChange={(e) => setMaterialForm({...materialForm, unitPrice: e.target.value})} placeholder="Unit price (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="number" value={materialForm.minStockLevel || ""} onChange={(e) => setMaterialForm({...materialForm, minStockLevel: e.target.value})} placeholder="Min stock level" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <select value={materialForm.vendorId || ""} onChange={(e) => setMaterialForm({...materialForm, vendorId: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2">
                  <option value="">Select vendor (optional)</option>
                  {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Add Material</button>
                <button type="button" onClick={() => { setShowMaterialForm(false); setMaterialForm({}); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          )}
          {(project.materials || []).length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<Boxes className="w-10 h-10" />} title="No materials added yet" hint="Add materials to track inventory, costs, and stock levels for this project." />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50">
                    {["Item", "Category", "Qty", "Unit", "Unit Price", "Stock", "Min Stock", "Vendor", "Status", ""].map((h, i) => (
                      <th key={i} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {(project.materials || []).map((m: any) => (
                      editingMaterialId === m.id ? (
                        <tr key={m.id + "-edit"} className="border-b border-blue-100 bg-blue-50">
                          <td colSpan={10} className="py-3 px-3">
                            <form onSubmit={(e) => updateMaterial(e, m.id)} className="grid grid-cols-4 gap-2">
                              <input required value={editMaterialForm.itemName || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, itemName: e.target.value})} placeholder="Item name *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <select value={editMaterialForm.category || "general"} onChange={(e) => setEditMaterialForm({...editMaterialForm, category: e.target.value})} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                                <option value="masonry">Masonry</option><option value="steel">Steel</option><option value="binding">Cement/Binding</option>
                                <option value="aggregate">Aggregate</option><option value="tiles">Tiles</option><option value="electrical">Electrical</option>
                                <option value="plumbing">Plumbing</option><option value="paint">Paint</option><option value="general">General</option>
                              </select>
                              <input required type="number" value={editMaterialForm.quantity || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, quantity: e.target.value})} placeholder="Qty *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <input required value={editMaterialForm.unit || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, unit: e.target.value})} placeholder="Unit" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <input required type="number" step="0.01" value={editMaterialForm.unitPrice || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, unitPrice: e.target.value})} placeholder="Unit price *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <input type="number" value={editMaterialForm.stockQuantity ?? ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, stockQuantity: e.target.value})} placeholder="Stock qty" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <input type="number" value={editMaterialForm.minStockLevel ?? ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, minStockLevel: e.target.value})} placeholder="Min stock" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <select value={editMaterialForm.vendorId || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, vendorId: e.target.value})} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                                <option value="">No vendor</option>
                                {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                              </select>
                              <div className="col-span-4 flex gap-2 mt-1">
                                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">Save</button>
                                <button type="button" onClick={() => { setEditingMaterialId(null); setEditMaterialForm({}); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">Cancel</button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 font-medium text-gray-900 whitespace-nowrap">{m.itemName}</td>
                          <td className="py-3 px-3 text-gray-500 capitalize">{m.category}</td>
                          <td className="py-3 px-3 font-medium">{m.quantity}</td>
                          <td className="py-3 px-3 text-gray-500">{m.unit}</td>
                          <td className="py-3 px-3 whitespace-nowrap">PKR {m.unitPrice?.toLocaleString()}</td>
                          <td className="py-3 px-3 font-medium">{m.stockQuantity}</td>
                          <td className="py-3 px-3 text-gray-500">{m.minStockLevel}</td>
                          <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{m.vendor?.name || "—"}</td>
                          <td className="py-3 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${m.stockQuantity <= m.minStockLevel ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                              {m.stockQuantity <= m.minStockLevel ? "Low Stock" : "OK"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {canManage && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditingMaterialId(m.id); setEditMaterialForm({ itemName: m.itemName, category: m.category, quantity: m.quantity, unit: m.unit, unitPrice: m.unitPrice, stockQuantity: m.stockQuantity, minStockLevel: m.minStockLevel, vendorId: m.vendorId || "" }); setShowMaterialForm(false); }}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                  title="Edit"
                                ><Pencil className="w-3.5 h-3.5" /></button>
                                {deletingMaterialId === m.id ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => deleteMaterial(m.id)} className="text-xs px-2 py-0.5 bg-red-600 text-white rounded font-medium">Confirm</button>
                                    <button onClick={() => setDeletingMaterialId(null)} className="text-xs px-1.5 py-0.5 border border-gray-300 rounded"><X className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeletingMaterialId(m.id)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {(project.materials || []).map((m: any) => (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    {editingMaterialId === m.id ? (
                      <form onSubmit={(e) => updateMaterial(e, m.id)} className="space-y-2">
                        <p className="text-xs font-semibold text-blue-700 mb-2">Editing: {m.itemName}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input required value={editMaterialForm.itemName || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, itemName: e.target.value})} placeholder="Item name *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs col-span-2" />
                          <select value={editMaterialForm.category || "general"} onChange={(e) => setEditMaterialForm({...editMaterialForm, category: e.target.value})} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs">
                            <option value="masonry">Masonry</option><option value="steel">Steel</option><option value="binding">Cement/Binding</option>
                            <option value="aggregate">Aggregate</option><option value="tiles">Tiles</option><option value="electrical">Electrical</option>
                            <option value="plumbing">Plumbing</option><option value="paint">Paint</option><option value="general">General</option>
                          </select>
                          <input required value={editMaterialForm.unit || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, unit: e.target.value})} placeholder="Unit" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <input required type="number" value={editMaterialForm.quantity || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, quantity: e.target.value})} placeholder="Qty *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <input required type="number" step="0.01" value={editMaterialForm.unitPrice || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, unitPrice: e.target.value})} placeholder="Unit price *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <input type="number" value={editMaterialForm.stockQuantity ?? ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, stockQuantity: e.target.value})} placeholder="Stock qty" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <input type="number" value={editMaterialForm.minStockLevel ?? ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, minStockLevel: e.target.value})} placeholder="Min stock" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <select value={editMaterialForm.vendorId || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, vendorId: e.target.value})} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs col-span-2">
                            <option value="">No vendor</option>
                            {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button type="submit" className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">Save Changes</button>
                          <button type="button" onClick={() => { setEditingMaterialId(null); setEditMaterialForm({}); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-gray-900">{m.itemName}</p>
                            <p className="text-xs text-gray-500 capitalize">{m.category}{m.vendor?.name ? ` · ${m.vendor.name}` : ""}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${m.stockQuantity <= m.minStockLevel ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {m.stockQuantity <= m.minStockLevel ? "Low Stock" : "OK"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div><span className="text-gray-400">Qty: </span><span className="text-gray-700 font-medium">{m.quantity} {m.unit}</span></div>
                          <div><span className="text-gray-400">Unit Price: </span><span className="text-gray-700">PKR {m.unitPrice?.toLocaleString()}</span></div>
                          <div><span className="text-gray-400">Stock: </span><span className="text-gray-700 font-medium">{m.stockQuantity}</span></div>
                          <div><span className="text-gray-400">Min Stock: </span><span className="text-gray-700">{m.minStockLevel}</span></div>
                        </div>
                        {canManage && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => { setEditingMaterialId(m.id); setEditMaterialForm({ itemName: m.itemName, category: m.category, quantity: m.quantity, unit: m.unit, unitPrice: m.unitPrice, stockQuantity: m.stockQuantity, minStockLevel: m.minStockLevel, vendorId: m.vendorId || "" }); setShowMaterialForm(false); }}
                              className="flex-1 py-1.5 text-xs border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50"
                            ><span className="flex items-center justify-center gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</span></button>
                            {deletingMaterialId === m.id ? (
                              <div className="flex gap-1 flex-1">
                                <button onClick={() => deleteMaterial(m.id)} className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium">Confirm Delete</button>
                                <button onClick={() => setDeletingMaterialId(null)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <button onClick={() => setDeletingMaterialId(m.id)} className="flex-1 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"><span className="flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Remove</span></button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === "Finance" && (
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-900">Ledger Entries</h3>
          {(project.ledgerEntries || []).length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<Wallet className="w-10 h-10" />} title="No finance entries yet" hint="Ledger entries linked to this project will appear here." />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50">
                    {["Date", "Type", "Category", "Amount", "Description", "Account"].map(h => <th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {(project.ledgerEntries || []).map((e: any) => (
                      <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                        <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${e.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.type}</span></td>
                        <td className="py-3 px-3 text-gray-500 capitalize">{e.category}</td>
                        <td className={`py-3 px-3 font-semibold whitespace-nowrap ${e.type === "income" ? "text-green-600" : "text-red-600"}`}>PKR {e.amount?.toLocaleString()}</td>
                        <td className="py-3 px-3 text-gray-600 max-w-xs truncate">{e.description}</td>
                        <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{e.bankAccount?.name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {(project.ledgerEntries || []).map((e: any) => (
                  <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className={`font-semibold ${e.type === "income" ? "text-green-700" : "text-red-700"}`}>PKR {e.amount?.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 capitalize">{e.category}{e.bankAccount?.name ? ` · ${e.bankAccount.name}` : ""}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${e.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">{new Date(e.date).toLocaleDateString()}</span>
                      {e.description && <><span className="text-gray-300">·</span><span className="text-gray-600 truncate">{e.description}</span></>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-xs text-green-700 mb-1">Total Income</p>
              <p className="text-lg font-bold text-green-800">PKR {income.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-xs text-red-700 mb-1">Total Expense</p>
              <p className="text-lg font-bold text-red-800">PKR {expense.toLocaleString()}</p>
            </div>
            <div className={`${income - expense >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"} border rounded-xl p-4 text-center`}>
              <p className="text-xs text-blue-700 mb-1">Net Profit</p>
              <p className={`text-lg font-bold ${income - expense >= 0 ? "text-blue-800" : "text-red-800"}`}>PKR {(income - expense).toLocaleString()}</p>
            </div>
          </div>
        </div>
      )}

      {tab === "Team" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Assigned Team</h3>
          {(project.employees || []).map((pe: any) => (
            <div key={pe.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">{pe.employee?.name?.[0]}</div>
              <div>
                <p className="font-medium text-sm text-gray-900">{pe.employee?.name}</p>
                <p className="text-xs text-gray-500">{pe.role}</p>
              </div>
              <p className="ml-auto text-xs text-gray-400">Since {pe.startDate ? new Date(pe.startDate).toLocaleDateString() : "—"}</p>
            </div>
          ))}
          {(project.employees || []).length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<Users className="w-10 h-10" />} title="No team members assigned" hint="Assign employees to this project to track who's working on what." />
            </div>
          )}
        </div>
      )}

      {tab === "Documents" && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-900">Documents</h3>
          {(project.documents || []).map((doc: any) => (
            <div key={doc.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
              <FileText className="w-6 h-6 text-gray-400" />
              <div className="flex-1">
                <p className="font-medium text-sm text-gray-900">{doc.name}</p>
                <p className="text-xs text-gray-500">{doc.type} · {doc.uploadedBy?.name}</p>
              </div>
              <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">Download</a>
            </div>
          ))}
          {(project.documents || []).length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<FolderOpen className="w-10 h-10" />} title="No documents uploaded yet" hint="Upload contracts, blueprints, permits and other project files here." />
            </div>
          )}
        </div>
      )}

      {tab === "Report" && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Project Report (PDF)</h3>
          <p className="text-gray-500 text-sm mb-6">Download a complete multi-page PDF report including project summary, materials, financials, tasks & milestones.</p>
          <button onClick={downloadReport} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            <span className="flex items-center gap-1.5"><Download className="w-4 h-4" /> Download PDF Report</span>
          </button>
        </div>
      )}
    </div>
  );
}
