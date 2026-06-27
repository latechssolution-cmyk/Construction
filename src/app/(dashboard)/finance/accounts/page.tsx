"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Landmark } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function BankAccountsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: accounts, mutate, isLoading } = useSWR("/api/bank-accounts", fetcher);
  const [selected, setSelected] = useState<any>(null);
  const { data: statement } = useSWR(selected?`/api/bank-accounts/${selected.id}/statement`:null, fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);

  const canManage = ["admin"].includes(session?.user?.role||"");
  const list: any[] = Array.isArray(accounts) ? accounts : [];

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/bank-accounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if(!res.ok){const e=await res.json();toast({ title: "Error", description: e.error || "Failed to add account", variant: "destructive" });return;}
      mutate(); setShowForm(false); setForm({});
    } finally { setLoading(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Bank Accounts</h1>
        {canManage && <button onClick={()=>setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ Add Account</button>}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">New Bank Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Account Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required value={form.accountNumber||""} onChange={e=>setForm({...form,accountNumber:e.target.value})} placeholder="Account Number *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required value={form.bankName||""} onChange={e=>setForm({...form,bankName:e.target.value})} placeholder="Bank Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="number" step="0.01" value={form.balance||""} onChange={e=>setForm({...form,balance:e.target.value})} placeholder="Opening Balance" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select value={form.currency||"PKR"} onChange={e=>setForm({...form,currency:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {["PKR","USD","EUR"].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Saving...":"Add Account"}</button>
            <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? <CardGridSkeleton count={3} /> : list.length>0 && (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((acc:any)=>(
          <button key={acc.id} onClick={()=>setSelected(selected?.id===acc.id?null:acc)} className={`text-left bg-white border rounded-xl p-5 shadow-sm transition-all ${selected?.id===acc.id?"border-blue-500 ring-2 ring-blue-100":"border-gray-200 hover:border-blue-300"}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-lg">{acc.bankName?.[0]||"B"}</div>
              <span className="text-xs text-gray-400">{acc._count?.ledgerEntries||0} entries</span>
            </div>
            <h3 className="font-semibold text-gray-900">{acc.name}</h3>
            <p className="text-xs text-gray-500">{acc.bankName} · {acc.accountNumber}</p>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">Balance</p>
              <p className="text-xl font-bold text-gray-900">{acc.currency||"PKR"} {(acc.balance||0).toLocaleString()}</p>
            </div>
          </button>
        ))}
      </div>
      )}

      {selected && statement && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50">
            <h2 className="font-semibold">Statement: {selected.name}</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
              <span className="text-green-600 font-medium">Income: PKR {statement.summary?.totalIncome?.toLocaleString()}</span>
              <span className="text-red-500 font-medium">Expense: PKR {statement.summary?.totalExpense?.toLocaleString()}</span>
              <span className="font-bold">Net: PKR {statement.summary?.net?.toLocaleString()}</span>
            </div>
          </div>
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              {["Date","Description","Category","Type","Amount","Running Balance"].map(h=><th key={h} className="text-left py-2 px-4 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {(()=>{
                const entries: any[] = statement.entries || [];
                const totalNet = entries.reduce((s:number,e:any)=>s+(e.type==="income"?e.amount:-e.amount),0);
                let bal = (statement.account?.balance||0) - totalNet;
                return entries.map((e:any)=>{
                  bal += e.type==="income" ? e.amount : -e.amount;
                  const snap = bal;
                  return (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="py-2 px-4 text-gray-900 max-w-xs truncate">{e.description||e.partyName||"—"}</td>
                      <td className="py-2 px-4 text-gray-500 capitalize whitespace-nowrap">{e.category||"—"}</td>
                      <td className="py-2 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${e.type==="income"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{e.type}</span></td>
                      <td className={`py-2 px-4 font-medium whitespace-nowrap ${e.type==="income"?"text-green-600":"text-red-500"}`}>{e.type==="income"?"+":"-"}PKR {e.amount?.toLocaleString()}</td>
                      <td className={`py-2 px-4 font-semibold whitespace-nowrap ${snap>=0?"text-gray-800":"text-red-600"}`}>PKR {snap.toLocaleString()}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
          </div>

          {/* Mobile statement cards */}
          <div className="md:hidden p-3 space-y-3">
            {(()=>{
              const entries: any[] = statement.entries || [];
              const totalNet = entries.reduce((s:number,e:any)=>s+(e.type==="income"?e.amount:-e.amount),0);
              let bal = (statement.account?.balance||0) - totalNet;
              return entries.map((e:any)=>{
                bal += e.type==="income" ? e.amount : -e.amount;
                const snap = bal;
                return (
                  <div key={e.id} className="border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{e.description||e.partyName||"—"}</p>
                        <p className="text-xs text-gray-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${e.type==="income"?"bg-green-100 text-green-700":"bg-red-100 text-red-700"}`}>{e.type}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                      <div><span className="text-gray-400">Category: </span><span className="text-gray-700 capitalize">{e.category||"—"}</span></div>
                      <div className="text-right"><span className="text-gray-400">Amount: </span><span className={`font-medium whitespace-nowrap ${e.type==="income"?"text-green-600":"text-red-500"}`}>{e.type==="income"?"+":"-"}PKR {e.amount?.toLocaleString()}</span></div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between text-xs">
                      <span className="text-gray-400">Running Balance</span>
                      <span className={`font-semibold whitespace-nowrap ${snap>=0?"text-gray-800":"text-red-600"}`}>PKR {snap.toLocaleString()}</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          {(!statement.entries||statement.entries.length===0)&&<div className="text-center py-8 text-gray-400 text-sm">No transactions found</div>}
        </div>
      )}

      {!isLoading && list.length===0 && (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Landmark className="w-10 h-10" />} title="No bank accounts yet" hint="Add your company bank accounts to track balances and link them to ledger entries." />
        </div>
      )}
    </div>
  );
}
