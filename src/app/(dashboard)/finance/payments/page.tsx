"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { CreditCard } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function PaymentsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: payments, mutate, isLoading } = useSWR("/api/payments", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const { data: vendors } = useSWR("/api/vendors", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [typeFilter, setTypeFilter] = useState("");
  const [form, setForm] = useState<any>({ type:"expense", category:"vendor_payment" });
  const [loading, setLoading] = useState(false);

  const canManage = ["admin","accountant"].includes(session?.user?.role||"");
  const list: any[] = Array.isArray(payments) ? payments : [];
  const filtered = list.filter((p:any)=>!typeFilter||p.type===typeFilter);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/payments",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if(!res.ok){const e=await res.json();toast({ title: "Error", description: e.error || "Failed to record payment", variant: "destructive" });return;}
      mutate(); setShowForm(false); setForm({type:"expense",category:"vendor_payment"});
    } finally { setLoading(false); }
  }

  const totalIn = filtered.filter((p:any)=>p.type==="income").reduce((s:number,p:any)=>s+p.amount,0);
  const totalOut = filtered.filter((p:any)=>p.type==="expense").reduce((s:number,p:any)=>s+p.amount,0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
        {canManage && <button onClick={()=>setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ Record Payment</button>}
      </div>

      {isLoading ? <StatsSkeleton count={3} /> : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-700 font-medium">Money In</p>
          <p className="text-2xl font-bold text-green-800">PKR {totalIn.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-700 font-medium">Money Out</p>
          <p className="text-2xl font-bold text-red-800">PKR {totalOut.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 font-medium">Net Flow</p>
          <p className={`text-2xl font-bold ${totalIn-totalOut>=0?"text-blue-800":"text-orange-700"}`}>PKR {(totalIn-totalOut).toLocaleString()}</p>
        </div>
      </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Payments</option>
          <option value="income">Received</option>
          <option value="expense">Paid Out</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Record Payment</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select value={form.type||"expense"} onChange={e=>setForm({...form,type:e.target.value,category:e.target.value==="income"?"client_payment":"vendor_payment"})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="income">Money Received</option>
              <option value="expense">Money Paid Out</option>
            </select>
            <input required type="number" step="0.01" value={form.amount||""} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="Amount (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required type="date" value={form.date||""} onChange={e=>setForm({...form,date:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select value={form.bankAccountId||""} onChange={e=>setForm({...form,bankAccountId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Bank Account</option>
              {(bankAccounts||[]).map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <select value={form.vendorId||""} onChange={e=>setForm({...form,vendorId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Vendor (optional)</option>
              {(vendors||[]).map((v:any)=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select value={form.projectId||""} onChange={e=>setForm({...form,projectId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Project (optional)</option>
              {(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={form.partyName||""} onChange={e=>setForm({...form,partyName:e.target.value})} placeholder="Party Name" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={form.referenceNumber||""} onChange={e=>setForm({...form,referenceNumber:e.target.value})} placeholder="Reference / Cheque #" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description" rows={2} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:col-span-3 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Saving...":"Record Payment"}</button>
            <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<CreditCard className="w-10 h-10" />} title="No payments recorded" hint="Record payments to vendors and clients here. Payments are logged in the General Ledger automatically." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-gray-200 bg-gray-50">
                {["Date","Type","Project","Party","Bank Account","Reference","Description","Amount"].map(h=><th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
              </tr></thead>
              <tbody>
                {filtered.map((p:any)=>(
                  <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full ${p.type==="income"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{p.type==="income"?"Received":"Paid Out"}</span></td>
                    <td className="py-3 px-3 text-gray-500">{p.project?.name||"—"}</td>
                    <td className="py-3 px-3 text-gray-700">{p.partyName||p.vendor?.name||"—"}</td>
                    <td className="py-3 px-3 text-gray-500">{p.bankAccount?.name||"—"}</td>
                    <td className="py-3 px-3 text-gray-400 font-mono text-xs">{p.referenceNumber||"—"}</td>
                    <td className="py-3 px-3 text-gray-500 max-w-xs truncate">{p.description||"—"}</td>
                    <td className={`py-3 px-3 font-bold whitespace-nowrap ${p.type==="income"?"text-green-600":"text-red-500"}`}>{p.type==="income"?"+":"-"}PKR {p.amount?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((p:any)=>(
              <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{p.partyName||p.vendor?.name||"—"}</p>
                    <p className="text-xs text-gray-500 whitespace-nowrap">{new Date(p.date).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${p.type==="income"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{p.type==="income"?"Received":"Paid Out"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <div><span className="text-gray-400">Project: </span><span className="text-gray-700">{p.project?.name||"—"}</span></div>
                  <div><span className="text-gray-400">Bank: </span><span className="text-gray-700">{p.bankAccount?.name||"—"}</span></div>
                  <div><span className="text-gray-400">Reference: </span><span className="text-gray-700 font-mono">{p.referenceNumber||"—"}</span></div>
                  <div className="col-span-2"><span className="text-gray-400">Description: </span><span className="text-gray-700">{p.description||"—"}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                  <span className={`font-bold whitespace-nowrap ${p.type==="income"?"text-green-600":"text-red-500"}`}>{p.type==="income"?"+":"-"}PKR {p.amount?.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
