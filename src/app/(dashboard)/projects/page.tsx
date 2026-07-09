"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { HardHat, Search, ClipboardList, Wallet } from "lucide-react";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { getStatusColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ProjectsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { data: projects, mutate, isLoading: projectsLoading } = useSWR("/api/projects", fetcher);
  const { data: clients } = useSWR("/api/clients", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setSearch(q);
    }
  }, []);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const canManage = ["admin","ceo","manager"].includes(session?.user?.role || "");

  async function updateStatus(id: string, status: string) {
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
    if (form.budget !== undefined && form.budget !== "" && parseFloat(form.budget) < 0) {
      toast({ title: "Validation Error", description: "Budget cannot be negative.", variant: "destructive" });
      return;
    }
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      toast({ title: "Validation Error", description: "End date cannot be before start date.", variant: "destructive" });
      return;
    }
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
      <PageHeader
        title="Projects"
        subtitle={`${filtered.length} total project${filtered.length !== 1 ? "s" : ""}`}
        actions={canManage && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors">
            + New Project
          </button>
        )}
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects..." className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
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
              <input type="number" min="0" step="0.01" value={form.budget || ""} onChange={(e) => setForm({...form, budget: e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., 5000000" />
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
      {projectsLoading ? <CardGridSkeleton count={6} /> : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((project: any) => {
          const totalWeight = (project.tasks || []).reduce((sum: number, t: any) => sum + (t.weight || 1), 0);
          const completedWeight = (project.tasks || []).filter((t: any) => t.status === "completed").reduce((sum: number, t: any) => sum + (t.weight || 1), 0);
          const progress = totalWeight ? Math.round((completedWeight / totalWeight) * 100) : (project.completionPercent || 0);
          const totalTasks = (project.tasks || []).length;

          return (
            <div
              key={project.id}
              onClick={() => router.push(`/projects/${project.id}`)}
              className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all cursor-pointer block"
            >
              <div className="flex items-start justify-between mb-3 gap-2">
                <h3 className="font-semibold text-gray-900 text-sm leading-tight flex-1">{project.name}</h3>
                {canManage ? (
                  <select
                    value={project.status}
                    onClick={(ev) => ev.stopPropagation()}
                    onMouseDown={(ev) => ev.stopPropagation()}
                    onChange={(ev) => {
                      ev.stopPropagation();
                      updateStatus(project.id, ev.target.value);
                    }}
                    className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize border-0 cursor-pointer shrink-0 ${getStatusColor(project.status)}`}
                  >
                    <option value="planning">planning</option>
                    <option value="in_progress">in progress</option>
                    <option value="on_hold">on hold</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                ) : (
                  <StatusBadge status={project.status} className="shrink-0" />
                )}
              </div>
              <p className="text-xs text-gray-500 mb-2">{project.location || "—"} · <span className="capitalize">{project.type}</span></p>
              {project.client && <p className="text-xs font-medium text-blue-600 mb-3">{project.client.name}</p>}
              <div className="mb-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Progress</span><span className="font-medium text-gray-700">{progress}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-1.5 rounded-full transition-all ${progress >= 100 ? "bg-green-500" : "bg-blue-500"}`} style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="flex justify-between items-center text-xs text-gray-500 pt-3 border-t border-gray-100">
                <span className="flex items-center gap-1"><ClipboardList className="w-3 h-3" />{totalTasks} tasks</span>
                <span className="flex items-center gap-1 font-medium text-gray-700"><Wallet className="w-3 h-3 text-gray-400" />PKR {(project.budget || 0).toLocaleString()}</span>
              </div>
            </div>
          );
        })}
      </div>}

      {!projectsLoading && filtered.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <EmptyState
            icon={<HardHat className="w-10 h-10" />}
            title="No projects found"
            hint={canManage ? "Projects are the heart of your ERP. Click “+ New Project” to create your first one." : "No projects match your current filters."}
          />
        </div>
      )}
    </div>
  );
}
