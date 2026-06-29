"use client";
import useSWR from "swr";
import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { HardHat } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_COLORS: Record<string, string> = {
  planning: "bg-yellow-100 text-yellow-800",
  in_progress: "bg-blue-100 text-blue-800",
  on_hold: "bg-orange-100 text-orange-800",
  completed: "bg-green-100 text-green-800",
};

export default function ProjectsPage() {
  const { data: session } = useSession();
  const { data: projects, mutate } = useSWR("/api/projects", fetcher);
  const { data: clients } = useSWR("/api/clients", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const canManage = ["admin","ceo","manager"].includes(session?.user?.role || "");

  async function updateStatus(id: string, status: string, ev: React.MouseEvent) {
    ev.preventDefault(); ev.stopPropagation();
    const res = await fetch(`/api/projects/${id}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ status }) });
    if (!res.ok) { const e = await res.json().catch(()=>({})); toast({ title: "Error", description: e.error || "Failed to update status", variant: "destructive" }); return; }
    mutate();
  }

  const filtered = (Array.isArray(projects) ? projects : []).filter((p: any) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase()) || p.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const e = await res.json().catch(()=>({})); toast({ title: "Error", description: e.error || "Failed to create project", variant: "destructive" }); return; }
      mutate();
      setShowForm(false);
      setForm({});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500">{filtered.length} total projects</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
            + New Project
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56" />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
          <option value="all">All Status</option>
          <option value="planning">Planning</option>
          <option value="in_progress">In Progress</option>
          <option value="on_hold">On Hold</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* New Project Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Create New Project</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
              <input required value={form.name || ""} onChange={(e) => setForm({...form, name: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., Gulberg Tower Phase 2" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
              <select value={form.clientId || ""} onChange={(e) => setForm({...form, clientId: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Select client</option>
                {(clients || []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type || "residential"} onChange={(e) => setForm({...form, type: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
                <option value="industrial">Industrial</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="renovation">Renovation</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
              <input value={form.location || ""} onChange={(e) => setForm({...form, location: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="City, Area" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Budget (PKR)</label>
              <input type="number" value={form.budget || ""} onChange={(e) => setForm({...form, budget: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 5000000" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input type="date" value={form.startDate || ""} onChange={(e) => setForm({...form, startDate: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input type="date" value={form.endDate || ""} onChange={(e) => setForm({...form, endDate: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={form.description || ""} onChange={(e) => setForm({...form, description: e.target.value})} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {loading ? "Creating..." : "Create Project"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm">Cancel</button>
          </div>
        </form>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((project: any) => {
          const completedTasks = (project.tasks || []).filter((t: any) => t.status === "completed").length;
          const totalTasks = (project.tasks || []).length;
          const progress = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : (project.completionPercent || 0);

          return (
            <Link key={project.id} href={`/projects/${project.id}`} className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow block">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight flex-1 mr-2">{project.name}</h3>
                {canManage ? (
                  <select
                    value={project.status}
                    onClick={ev=>ev.stopPropagation()}
                    onChange={ev=>{ev.stopPropagation();updateStatus(project.id,ev.target.value,ev as any);}}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium border-0 cursor-pointer ${STATUS_COLORS[project.status] || "bg-gray-100 text-gray-700"}`}
                  >
                    <option value="planning">planning</option>
                    <option value="in_progress">in progress</option>
                    <option value="on_hold">on hold</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[project.status] || "bg-gray-100 text-gray-700"}`}>
                    {project.status?.replace("_", " ") || "—"}
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mb-3">{project.location || "—"} · {project.type}</p>
              {project.client && <p className="text-xs text-blue-600 mb-3">{project.client.name}</p>}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span><span>{progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full">
                  <div className="h-1.5 bg-blue-500 rounded-full" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{totalTasks} tasks</span>
                <span>PKR {(project.budget || 0).toLocaleString()}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <HardHat className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-medium text-gray-700">No projects found</p><p className="text-sm mt-1 text-gray-400">Projects are the heart of your ERP. Click &quot;+ New Project&quot; to create your first one.</p>
          {canManage && <p className="text-sm mt-1">Click "New Project" to get started</p>}
        </div>
      )}
    </div>
  );
}
