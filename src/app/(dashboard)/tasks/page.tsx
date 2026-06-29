"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const STATUSES = ["todo","in_progress","on_hold","completed"];
const STATUS_LABELS: Record<string,string> = { todo:"To Do", in_progress:"In Progress", on_hold:"On Hold", completed:"Completed" };
const STATUS_COLORS: Record<string,string> = { todo:"bg-gray-100 text-gray-700", in_progress:"bg-blue-100 text-blue-700", on_hold:"bg-yellow-100 text-yellow-700", completed:"bg-green-100 text-green-700" };
const PRIORITIES = ["low","medium","high","critical"];
const PRIORITY_COLORS: Record<string,string> = { low:"bg-gray-100 text-gray-600", medium:"bg-blue-100 text-blue-600", high:"bg-orange-100 text-orange-600", critical:"bg-red-100 text-red-600" };

export default function TasksPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: tasks, mutate, isLoading } = useSWR("/api/tasks", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const { data: users } = useSWR("/api/users/assignable", fetcher);
  const [projectFilter, setProjectFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [view, setView] = useState<"kanban"|"list">("kanban");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ status:"todo", priority:"medium" });
  const [loading, setLoading] = useState(false);

  const canCreate = ["admin","manager"].includes(session?.user?.role||"");
  const canDelete = ["admin","manager"].includes(session?.user?.role||"");
  const list: any[] = Array.isArray(tasks) ? tasks : [];
  const filtered = list.filter((t:any) => {
    return (
      (!projectFilter || t.projectId === projectFilter) &&
      (!priorityFilter || t.priority === priorityFilter) &&
      (!statusFilter || t.status === statusFilter)
    );
  });

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/tasks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if(!res.ok){const e=await res.json();toast({ title: "Error", description: e.error || "Failed to create task", variant: "destructive" });return;}
      mutate(); setShowForm(false); setForm({status:"todo",priority:"medium"});
    } finally { setLoading(false); }
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/tasks/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status})});
    if (!res.ok) { const e = await res.json().catch(()=>({})); toast({ title: "Error", description: e.error || "Failed to update task", variant: "destructive" }); return; }
    mutate();
  }

  async function deleteTask(id: string) {
    if (!confirm("Delete this task?")) return;
    const res = await fetch(`/api/tasks/${id}`,{method:"DELETE"});
    if (!res.ok) { const e = await res.json().catch(()=>({})); toast({ title: "Error", description: e.error || "Failed to delete task", variant: "destructive" }); return; }
    mutate();
  }

  const byStatus = (s: string) => filtered.filter((t:any)=>t.status===s);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-sm text-gray-500">{filtered.length} tasks</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={()=>setView("kanban")} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view==="kanban"?"bg-blue-100 text-blue-700":"border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>Kanban</button>
          <button onClick={()=>setView("list")} className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${view==="list"?"bg-blue-100 text-blue-700":"border border-gray-200 text-gray-700 hover:bg-gray-50"}`}>List</button>
          {canCreate && <button onClick={()=>setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ Add Task</button>}
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Projects</option>
          {(Array.isArray(projects)?projects:[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Priorities</option>
          {PRIORITIES.map(p=><option key={p} value={p} className="capitalize">{p}</option>)}
        </select>
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Statuses</option>
          {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">New Task</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Task Title *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description" rows={2} className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select required value={form.projectId||""} onChange={e=>setForm({...form,projectId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Project *</option>
              {(Array.isArray(projects)?projects:[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.assignedToId||""} onChange={e=>setForm({...form,assignedToId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Assign To (optional)</option>
              {(Array.isArray(users)?users:[]).map((u:any)=><option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
            <select value={form.priority||"medium"} onChange={e=>setForm({...form,priority:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {PRIORITIES.map(p=><option key={p} value={p} className="capitalize">{p}</option>)}
            </select>
            <select value={form.status||"todo"} onChange={e=>setForm({...form,status:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <input type="date" value={form.dueDate||""} onChange={e=>setForm({...form,dueDate:e.target.value})} placeholder="Due Date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="number" step="0.5" value={form.estimatedHours||""} onChange={e=>setForm({...form,estimatedHours:e.target.value})} placeholder="Estimated Hours" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Saving...":"Create Task"}</button>
            <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : view==="kanban" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STATUSES.map(status=>(
            <div key={status} className="bg-gray-50 rounded-xl p-3 space-y-3 min-h-64">
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
                <span className="text-xs text-gray-400">{byStatus(status).length}</span>
              </div>
              {byStatus(status).map((t:any)=>(
                <div key={t.id} className="bg-white rounded-lg p-3 shadow-sm space-y-2">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-sm font-medium text-gray-900 flex-1">{t.title}</p>
                    {canDelete && <button onClick={()=>deleteTask(t.id)} className="text-gray-300 hover:text-red-400 text-xs flex-shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>}
                  </div>
                  {t.project && <p className="text-xs text-blue-600">{t.project.name}</p>}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLORS[t.priority||"medium"]}`}>{t.priority||"medium"}</span>
                    {t.dueDate && <span className={`text-xs ${new Date(t.dueDate)<new Date()&&t.status!=="completed"?"text-red-500":"text-gray-400"}`}>{new Date(t.dueDate).toLocaleDateString()}</span>}
                  </div>
                  {t.assignedTo && <p className="text-xs text-gray-500">{t.assignedTo.name}</p>}
                  <select value={t.status} onChange={e=>updateStatus(t.id,e.target.value)} className="text-xs border border-gray-200 rounded px-1 py-0.5 w-full mt-1">
                    {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>
              ))}
              {byStatus(status).length===0 && <p className="text-xs text-gray-300 text-center py-4">No tasks</p>}
            </div>
          ))}
        </div>
      ) : filtered.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<ClipboardList className="w-10 h-10" />} title="No tasks found" hint='Tasks help you track work on a project. Click "+ New Task" to create the first one.' />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 bg-gray-50">
                {["Title","Project","Assigned To","Priority","Status","Due Date","Actions"].map(h=><th key={h} className="text-left py-3 px-4 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((t:any)=>(
                  <tr key={t.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900">{t.title}</td>
                    <td className="py-3 px-4 text-gray-500">{t.project?.name||"—"}</td>
                    <td className="py-3 px-4 text-gray-500">{t.assignedTo?.name||"Unassigned"}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[t.priority||"medium"]}`}>{t.priority||"medium"}</span></td>
                    <td className="py-3 px-4">
                      <select value={t.status} onChange={e=>updateStatus(t.id,e.target.value)} className={`text-xs px-2 py-0.5 rounded-full border border-gray-200 bg-white cursor-pointer`}>
                        {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                      </select>
                    </td>
                    <td className={`py-3 px-4 text-sm whitespace-nowrap ${t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=="completed"?"text-red-500":"text-gray-500"}`}>{t.dueDate?new Date(t.dueDate).toLocaleDateString():"—"}</td>
                    <td className="py-3 px-4">
                      {canDelete && <button onClick={()=>deleteTask(t.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline">Delete</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((t:any)=>(
              <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{t.title}</p>
                    <p className="text-xs text-gray-500">{t.project?.name||"—"}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_COLORS[t.priority||"medium"]}`}>{t.priority||"medium"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <div><span className="text-gray-400">Assigned: </span><span className="text-gray-700">{t.assignedTo?.name||"Unassigned"}</span></div>
                  <div><span className="text-gray-400">Due: </span><span className={`whitespace-nowrap ${t.dueDate&&new Date(t.dueDate)<new Date()&&t.status!=="completed"?"text-red-500":"text-gray-700"}`}>{t.dueDate?new Date(t.dueDate).toLocaleDateString():"—"}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                  <select value={t.status} onChange={e=>updateStatus(t.id,e.target.value)} className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white cursor-pointer">
                    {STATUSES.map(s=><option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                  {canDelete && <button onClick={()=>deleteTask(t.id)} className="text-xs text-red-400 hover:text-red-600 hover:underline">Delete</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
