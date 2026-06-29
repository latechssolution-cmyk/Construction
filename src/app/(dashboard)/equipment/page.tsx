"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Truck, MapPin, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());
const STATUS_COLORS: Record<string,string> = { available:"bg-green-100 text-green-800", in_use:"bg-blue-100 text-blue-800", maintenance:"bg-yellow-100 text-yellow-800", decommissioned:"bg-red-100 text-red-800" };
const COND_COLORS: Record<string,string> = { excellent:"text-green-600", good:"text-blue-600", fair:"text-yellow-600", poor:"text-red-600" };

export default function EquipmentPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: equipment, mutate, isLoading } = useSWR("/api/equipment", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<string|null>(null);
  const [assignProjectId, setAssignProjectId] = useState("");
  const [maintModal, setMaintModal] = useState<any>(null);
  const [maintForm, setMaintForm] = useState<any>({});
  const [maintLoading, setMaintLoading] = useState(false);

  const canManage = ["admin","manager"].includes(session?.user?.role||"");
  const filtered = (Array.isArray(equipment)?equipment:[]).filter((e:any)=>
    e.name?.toLowerCase().includes(search.toLowerCase())||e.type?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/equipment",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if(!res.ok){const e=await res.json();toast({ title: "Error", description: e.error || "Failed to save equipment", variant: "destructive" });return;}
      mutate(); setShowForm(false); setForm({});
    } finally { setLoading(false); }
  }

  async function handleAssign(id: string) {
    await fetch(`/api/equipment/${id}/assign`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({projectId:assignProjectId})});
    mutate(); setAssigning(null); setAssignProjectId("");
  }

  async function handleReturn(id: string) {
    await fetch(`/api/equipment/${id}/assign`,{method:"DELETE"});
    mutate();
  }

  function openMaintModal(eq: any) {
    const today = new Date().toISOString().slice(0, 10);
    setMaintForm({ cost: "", description: "", date: today, condition: eq.condition || "good", bankAccountId: "", projectId: "" });
    setMaintModal(eq);
  }

  async function handleLogMaintenance(ev: React.FormEvent) {
    ev.preventDefault();
    setMaintLoading(true);
    try {
      const res = await fetch(`/api/equipment/${maintModal.id}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(maintForm),
      });
      if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.error || "Failed to log maintenance", variant: "destructive" }); return; }
      toast({ title: "Maintenance logged", description: `Recorded for ${maintModal.name}` });
      setMaintModal(null);
      mutate();
    } finally { setMaintLoading(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Equipment</h1><p className="text-sm text-gray-500">{filtered.length} items</p></div>
        {canManage && <button onClick={()=>setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ Add Equipment</button>}
      </div>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search equipment..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Add Equipment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Equipment Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select required value={form.type||""} onChange={e=>setForm({...form,type:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Type *</option>
              {["excavator","crane","mixer","generator","compactor","drill","scaffold","vehicle","pump","other"].map(t=><option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
            <input value={form.model||""} onChange={e=>setForm({...form,model:e.target.value})} placeholder="Model" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={form.serialNumber||""} onChange={e=>setForm({...form,serialNumber:e.target.value})} placeholder="Serial Number" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="date" value={form.purchaseDate||""} onChange={e=>setForm({...form,purchaseDate:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="number" value={form.purchasePrice||""} onChange={e=>setForm({...form,purchasePrice:e.target.value})} placeholder="Purchase Price (PKR)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select value={form.condition||"good"} onChange={e=>setForm({...form,condition:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option>
            </select>
            <input value={form.location||""} onChange={e=>setForm({...form,location:e.target.value})} placeholder="Location/Site" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Saving...":"Add"}</button>
            <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <CardGridSkeleton />
      ) : filtered.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Truck className="w-10 h-10" />} title="No equipment found" hint="Track your machinery, tools, and vehicles here. Add equipment to assign it to projects." />
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((eq:any)=>{
          const activeAssignment = (eq.assignments||[]).find((pe:any)=>!pe.returnedAt);
          return (
            <div key={eq.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">{eq.name}</h3>
                  <p className="text-xs text-gray-500 capitalize">{eq.type}{eq.model?` · ${eq.model}`:""}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[eq.status]||"bg-gray-100 text-gray-600"}`}>{eq.status?.replace("_"," ")}</span>
              </div>
              {eq.serialNumber && <p className="text-xs text-gray-400">S/N: {eq.serialNumber}</p>}
              <div className="flex gap-3 text-sm">
                <span>Condition: <strong className={COND_COLORS[eq.condition]||""}>{eq.condition}</strong></span>
              </div>
              {eq.purchasePrice && <p className="text-xs text-gray-500">Value: PKR {eq.purchasePrice.toLocaleString()}</p>}
              {activeAssignment && <span className="flex items-center gap-1 text-xs text-blue-600"><MapPin className="w-3 h-3" />{activeAssignment.project?.name}</span>}
              {canManage && (
                <div className="flex gap-2 pt-2 border-t border-gray-100 flex-wrap">
                  <button onClick={()=>openMaintModal(eq)} className="text-xs text-yellow-700 hover:underline font-medium">Log Maintenance</button>
                  {!activeAssignment ? (
                    assigning===eq.id ? (
                      <div className="flex gap-2 w-full mt-1">
                        <select value={assignProjectId} onChange={e=>setAssignProjectId(e.target.value)} className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs">
                          <option value="">Select project</option>
                          {(Array.isArray(projects)?projects:[]).filter((p:any)=>["planning","in_progress","on_hold"].includes(p.status)).map((p:any)=><option key={p.id} value={p.id}>{p.name} ({p.status.replace("_"," ")})</option>)}
                        </select>
                        <button onClick={()=>handleAssign(eq.id)} disabled={!assignProjectId} className="px-2 py-1 bg-blue-600 text-white rounded text-xs disabled:opacity-50">Assign</button>
                        <button onClick={()=>setAssigning(null)} className="px-2 py-1 border border-gray-200 rounded text-xs">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={()=>setAssigning(eq.id)} className="text-xs text-blue-600 hover:underline">Assign to Project</button>
                    )
                  ) : (
                    <button onClick={()=>handleReturn(eq.id)} className="text-xs text-orange-600 hover:underline">Return from Project</button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      )}
      {/* Log Maintenance Modal */}
      {maintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Log Maintenance</h2>
                <p className="text-xs text-gray-500 mt-0.5">{maintModal.name}</p>
              </div>
              <button onClick={()=>setMaintModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleLogMaintenance} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Date *</label>
                  <input required type="date" value={maintForm.date} onChange={e=>setMaintForm({...maintForm,date:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cost (PKR)</label>
                  <input type="number" min="0" value={maintForm.cost} onChange={e=>setMaintForm({...maintForm,cost:e.target.value})} placeholder="0" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Description</label>
                <textarea value={maintForm.description} onChange={e=>setMaintForm({...maintForm,description:e.target.value})} rows={2} placeholder="What was serviced or repaired?" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Condition After</label>
                  <select value={maintForm.condition} onChange={e=>setMaintForm({...maintForm,condition:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Linked Project</label>
                  <select value={maintForm.projectId} onChange={e=>setMaintForm({...maintForm,projectId:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                    <option value="">None</option>
                    {(Array.isArray(projects)?projects:[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Pay From Bank Account</label>
                <select value={maintForm.bankAccountId} onChange={e=>setMaintForm({...maintForm,bankAccountId:e.target.value})} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                  <option value="">Not specified</option>
                  {(Array.isArray(bankAccounts)?bankAccounts:[]).map((b:any)=><option key={b.id} value={b.id}>{b.name} — PKR {(b.balance||0).toLocaleString()}</option>)}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={maintLoading} className="flex-1 py-2 bg-yellow-600 text-white rounded-lg text-sm font-medium hover:bg-yellow-700 disabled:opacity-50 transition-colors">
                  {maintLoading ? "Saving…" : "Log Maintenance"}
                </button>
                <button type="button" onClick={()=>setMaintModal(null)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
