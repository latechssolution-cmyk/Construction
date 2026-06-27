"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ExportButton } from "@/components/export-button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Package } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function MaterialsPage() {
  const { data: session } = useSession();
  const { data: materials, mutate, isLoading } = useSWR("/api/materials", fetcher);
  const { data: vendors } = useSWR("/api/vendors", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ unit:"bags", quantity:0, minStockLevel:5, unitPrice:0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  if (session && !["admin","ceo","manager"].includes(session.user?.role||"")) {
    return <div className="p-6 text-center text-gray-500"><p className="text-4xl mb-2">&#x1F512;</p><p className="font-medium">Access Restricted</p></div>;
  }

  const canManage = ["admin","manager"].includes(session?.user?.role||"");
  const list: any[] = Array.isArray(materials) ? materials : [];
  const filtered = list.filter((m:any)=>{
    if (search && !m.itemName?.toLowerCase().includes(search.toLowerCase()) && !m.category?.toLowerCase().includes(search.toLowerCase())) return false;
    if (lowStockOnly && m.stockQuantity > m.minStockLevel) return false;
    return true;
  });

  const lowStockCount = list.filter((m:any)=>m.stockQuantity<=m.minStockLevel).length;

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!form.itemName?.trim()) { setError("Material name is required."); return; }
    if (!form.projectId) { setError("Please select a project for this material."); return; }
    setLoading(true);
    try {
      const payload = {
        itemName: form.itemName,
        category: form.category || "general",
        unit: form.unit || "bags",
        quantity: parseFloat(String(form.quantity || 0)),
        minStockLevel: parseFloat(String(form.minStockLevel || 5)),
        unitPrice: parseFloat(String(form.unitPrice || 0)),
        projectId: form.projectId,
        vendorId: form.vendorId || null,
        notes: form.notes || null,
      };
      const res = await fetch("/api/materials", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); setError(e.error||"Failed to save"); return; }
      mutate(); setShowForm(false); setForm({ unit:"bags", quantity:0, minStockLevel:5, unitPrice:0 });
    } finally { setLoading(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materials</h1>
          <p className="text-sm text-gray-500">{filtered.length} items{lowStockCount>0&&<span className="text-red-500 font-medium"> · {lowStockCount} low stock</span>}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton module="materials" />
          {canManage && <button onClick={()=>{setShowForm(!showForm);setError("");}} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ Add Material</button>}
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex gap-3 flex-wrap items-center">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search materials..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        <button onClick={()=>setLowStockOnly(!lowStockOnly)} className={"px-3 py-1.5 text-sm rounded-lg "+(lowStockOnly?"bg-red-100 text-red-700":"border border-gray-200 text-gray-600 hover:bg-gray-50")}>
          &#x26A0;&#xFE0F; Low Stock Only
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg">Add Material</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-3">
              <input required value={form.itemName||""} onChange={e=>setForm({...form,itemName:e.target.value})} placeholder="Material Name * (e.g. Portland Cement)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <select required value={form.projectId||""} onChange={e=>setForm({...form,projectId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Project *</option>
              {(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={form.category||""} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Category (e.g. Cement, Steel)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={form.unit||"bags"} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="Unit (bags, kg, pcs...)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Quantity Received</label>
              <input type="number" step="0.01" min="0" value={form.quantity||0} onChange={e=>setForm({...form,quantity:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Unit Price (PKR)</label>
              <input type="number" step="0.01" min="0" value={form.unitPrice||0} onChange={e=>setForm({...form,unitPrice:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500">Min Stock Level (reorder point)</label>
              <input type="number" step="0.01" min="0" value={form.minStockLevel||5} onChange={e=>setForm({...form,minStockLevel:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <select value={form.vendorId||""} onChange={e=>setForm({...form,vendorId:e.target.value||undefined})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">No Vendor (optional)</option>
              {(vendors||[]).filter((v:any)=>v.isActive!==false).map((v:any)=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <div className="col-span-3 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-600">
              Estimated Total: <strong>PKR {(parseFloat(String(form.quantity||0)) * parseFloat(String(form.unitPrice||0))).toLocaleString()}</strong>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Saving…":"Add Material"}</button>
            <button type="button" onClick={()=>{setShowForm(false);setError("");}} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Package className="w-10 h-10" />} title="No materials found" hint="Track construction materials — cement, steel, bricks and more — with stock levels and reorder alerts." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Material","Category","Unit","Unit Price","In Stock","Min Level","Project","Vendor","Status"].map(h=><th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m:any)=>{
                  const isLow = m.stockQuantity <= m.minStockLevel;
                  return (
                    <tr key={m.id} className={"border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors "+(isLow?"bg-red-50/40":"")}>
                      <td className="py-3 px-3 font-medium text-gray-900">{m.itemName}</td>
                      <td className="py-3 px-3 text-gray-500 capitalize">{m.category||"—"}</td>
                      <td className="py-3 px-3 text-gray-500">{m.unit||"—"}</td>
                      <td className="py-3 px-3 text-gray-700 whitespace-nowrap">PKR {(m.unitPrice||0).toLocaleString()}</td>
                      <td className={"py-3 px-3 font-bold whitespace-nowrap "+(isLow?"text-red-600":"text-gray-900")}>{(m.stockQuantity||0).toLocaleString()} {m.unit}</td>
                      <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{(m.minStockLevel||0).toLocaleString()} {m.unit}</td>
                      <td className="py-3 px-3 text-gray-500">{m.project?.name||"—"}</td>
                      <td className="py-3 px-3 text-gray-500">{m.vendor?.name||"—"}</td>
                      <td className="py-3 px-3">{isLow?<span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">&#x26A0; Low</span>:<span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">OK</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((m:any)=>{
              const isLow = m.stockQuantity <= m.minStockLevel;
              return (
                <div key={m.id} className={"bg-white border border-gray-200 rounded-xl p-4 shadow-sm "+(isLow?"bg-red-50/40":"")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{m.itemName}</p>
                      <p className="text-xs text-gray-500 capitalize">{m.category||"—"}{m.unit?` · ${m.unit}`:""}</p>
                    </div>
                    {isLow?<span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium shrink-0">&#x26A0; Low</span>:<span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full shrink-0">OK</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                    <div><span className="text-gray-400">Unit Price: </span><span className="text-gray-700 whitespace-nowrap">PKR {(m.unitPrice||0).toLocaleString()}</span></div>
                    <div><span className="text-gray-400">In Stock: </span><span className={"whitespace-nowrap font-medium "+(isLow?"text-red-600":"text-gray-900")}>{(m.stockQuantity||0).toLocaleString()} {m.unit}</span></div>
                    <div><span className="text-gray-400">Min Level: </span><span className="text-gray-700 whitespace-nowrap">{(m.minStockLevel||0).toLocaleString()} {m.unit}</span></div>
                    <div><span className="text-gray-400">Project: </span><span className="text-gray-700">{m.project?.name||"—"}</span></div>
                    <div><span className="text-gray-400">Vendor: </span><span className="text-gray-700">{m.vendor?.name||"—"}</span></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
