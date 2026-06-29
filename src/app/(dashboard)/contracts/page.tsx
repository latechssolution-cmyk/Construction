"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { FileText } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());
const STATUS_COLORS: Record<string, string> = { active: "bg-green-100 text-green-800", completed: "bg-blue-100 text-blue-800", terminated: "bg-red-100 text-red-800", cancelled: "bg-red-100 text-red-700", on_hold: "bg-yellow-100 text-yellow-800", draft: "bg-gray-100 text-gray-700" };

export default function ContractsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: contracts, mutate, isLoading } = useSWR("/api/contracts", fetcher);
  const { data: clients } = useSWR("/api/clients", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const canManage = ["admin","manager"].includes(session?.user?.role || "");
  const filtered = (Array.isArray(contracts) ? contracts : []).filter((c: any) =>
    c.title?.toLowerCase().includes(search.toLowerCase()) || c.contractNumber?.toLowerCase().includes(search.toLowerCase())
  );

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/contracts/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.error || "Failed", variant: "destructive" }); return; }
    mutate();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/contracts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const err = await res.json(); toast({ title: "Error", description: err.error || "Failed to create contract", variant: "destructive" }); return; }
      mutate(); setShowForm(false); setForm({});
    } finally { setLoading(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Contracts</h1><p className="text-sm text-gray-500">{filtered.length} contracts</p></div>
        {canManage && <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ New Contract</button>}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search contracts..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">New Contract</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2"><input required value={form.title||""} onChange={e=>setForm({...form,title:e.target.value})} placeholder="Contract Title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <select required value={form.clientId||""} onChange={e=>setForm({...form,clientId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Client *</option>
              {(clients||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input type="number" step="0.01" required value={form.contractValue||""} onChange={e=>setForm({...form,contractValue:e.target.value})} placeholder="Contract Value (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="date" value={form.startDate||""} onChange={e=>setForm({...form,startDate:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="date" value={form.endDate||""} onChange={e=>setForm({...form,endDate:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <div className="sm:col-span-2"><textarea value={form.scope||""} onChange={e=>setForm({...form,scope:e.target.value})} placeholder="Scope of Work" rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div className="sm:col-span-2"><input value={form.paymentTerms||""} onChange={e=>setForm({...form,paymentTerms:e.target.value})} placeholder="Payment Terms" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Saving...":"Create"}</button>
            <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <CardGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText className="w-10 h-10" />} title="No contracts found" hint={'Contracts define the legal agreements for your projects. Click "+ New Contract" to add one.'} />
      ) : (
      <div className="space-y-3">
        {filtered.map((c: any) => (
          <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-gray-400">{c.contractNumber}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]||"bg-gray-100 text-gray-600"}`}>{c.status}</span>
                </div>
                <h3 className="font-semibold text-gray-900">{c.title}</h3>
                <p className="text-sm text-gray-500 mt-0.5">Client: {c.client?.name || "—"}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-blue-700 text-lg whitespace-nowrap">PKR {(c.contractValue||0).toLocaleString()}</p>
                {c.startDate && <p className="text-xs text-gray-400 whitespace-nowrap">{new Date(c.startDate).toLocaleDateString()} – {c.endDate ? new Date(c.endDate).toLocaleDateString() : "ongoing"}</p>}
              </div>
            </div>
            {c.scope && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.scope}</p>}
            {c.paymentTerms && <p className="text-xs text-gray-500 mt-1">{c.paymentTerms}</p>}
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-gray-400">{(c.projects||[]).length} linked projects</p>
              {canManage && !["terminated","cancelled"].includes(c.status) && (
                <select
                  value={c.status}
                  onChange={e=>updateStatus(c.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  {["draft","active","on_hold","completed","cancelled","terminated"].map(s=><option key={s} value={s}>{s.replace("_"," ")}</option>)}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
