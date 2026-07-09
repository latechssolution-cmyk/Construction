"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Landmark, Pencil, Trash2, X, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function BankAccountsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: accounts, mutate, isLoading } = useSWR("/api/bank-accounts", fetcher);
  const [selected, setSelected] = useState<any>(null);
  
  // Date range state for Statement Filter (Issue #49)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const statementUrl = selected 
    ? `/api/bank-accounts/${selected.id}/statement${startDate || endDate ? `?from=${startDate}&to=${endDate}` : ""}` 
    : null;
  const { data: statement } = useSWR(statementUrl, fetcher);

  // Forms state
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [loading, setLoading] = useState(false);

  // Edit / Delete state
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (session && !["admin","ceo","accountant"].includes(session.user?.role||"")) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-medium text-gray-700">Access Restricted</p>
      </div>
    );
  }

  const canManage = ["admin", "ceo"].includes(session?.user?.role||"");
  const list: any[] = Array.isArray(accounts) ? accounts : [];

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/bank-accounts",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if(!res.ok){const e=await res.json();toast({ title: "Error", description: e.error || "Failed to add account", variant: "destructive" });return;}
      toast({ title: "Account created", description: "The bank account has been added successfully." });
      mutate(); setShowForm(false); setForm({});
    } finally { setLoading(false); }
  }

  function startEdit(acc: any, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingAccount(acc);
    setEditForm({
      name: acc.name,
      bankName: acc.bankName || "",
      accountNumber: acc.accountNumber || "",
      notes: acc.notes || "",
    });
  }

  async function handleEditSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setEditLoading(true);
    try {
      const res = await fetch(`/api/bank-accounts/${editingAccount.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to update account", variant: "destructive" });
        return;
      }
      toast({ title: "Account updated", description: "The bank account details have been updated." });
      mutate();
      if (selected?.id === editingAccount.id) {
        setSelected({ ...selected, ...editForm });
      }
      setEditingAccount(null);
      setEditForm({});
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/bank-accounts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to deactivate account", variant: "destructive" });
      return;
    }
    toast({ title: "Account deactivated", description: "The account has been hidden." });
    setConfirmDeleteId(null);
    if (selected?.id === id) setSelected(null);
    mutate();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Bank Accounts"
        actions={canManage && <button onClick={()=>{setShowForm(!showForm); setEditingAccount(null);}} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 shadow-sm">{showForm ? "Cancel" : "+ Add Account"}</button>}
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">New Bank Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Account Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required value={form.accountNumber||""} onChange={e=>setForm({...form,accountNumber:e.target.value})} placeholder="Account Number *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required value={form.bankName||""} onChange={e=>setForm({...form,bankName:e.target.value})} placeholder="Bank Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="number" min="0" step="0.01" value={form.balance||""} onChange={e=>setForm({...form,balance:e.target.value})} placeholder="Opening Balance" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
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

      {editingAccount && (
        <form onSubmit={handleEditSubmit} className="bg-blue-50/50 border border-blue-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-blue-900">Edit Bank Account: {editingAccount.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={editForm.name||""} onChange={e=>setEditForm({...editForm,name:e.target.value})} placeholder="Account Name *" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required value={editForm.accountNumber||""} onChange={e=>setEditForm({...editForm,accountNumber:e.target.value})} placeholder="Account Number *" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required value={editForm.bankName||""} onChange={e=>setEditForm({...editForm,bankName:e.target.value})} placeholder="Bank Name *" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={editForm.notes||""} onChange={e=>setEditForm({...editForm,notes:e.target.value})} placeholder="Notes" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={editLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">{editLoading?"Saving...":"Save Changes"}</button>
            <button type="button" onClick={()=>{setEditingAccount(null); setEditForm({});}} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? <CardGridSkeleton count={3} /> : list.length>0 && (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {list.map((acc:any)=>(
          <div key={acc.id} onClick={()=>setSelected(selected?.id===acc.id?null:acc)} className={`group relative text-left bg-white border rounded-xl p-5 shadow-sm transition-all cursor-pointer ${selected?.id===acc.id?"border-blue-500 ring-2 ring-blue-100":"border-gray-200 hover:border-blue-300"}`}>
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
            
            {canManage && (
              <div className="absolute top-4 right-4 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => startEdit(acc, e)} className="p-1 text-blue-500 hover:bg-blue-50 rounded transition-colors" title="Edit account"><Pencil className="w-4 h-4" /></button>
                {confirmDeleteId === acc.id ? (
                  <span className="inline-flex items-center gap-1 bg-red-50 px-2 py-0.5 rounded border border-red-200" onClick={(e) => e.stopPropagation()}>
                    <span className="text-[10px] text-red-700 font-bold uppercase">Deactivate?</span>
                    <button onClick={(e) => handleDelete(acc.id, e)} className="text-[10px] px-1.5 py-0.5 bg-red-600 text-white rounded hover:bg-red-700">Yes</button>
                    <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }} className="text-[10px] px-1.5 py-0.5 bg-white border border-gray-200 rounded">No</button>
                  </span>
                ) : (
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(acc.id); }} className="p-1 text-red-400 hover:bg-red-50 rounded transition-colors" title="Deactivate account"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}

      {selected && statement && (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-6">
          <div className="p-4 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gray-50">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <Landmark className="w-5 h-5 text-gray-400" />
              Statement: {selected.name}
            </h2>
            
            {/* Date Range Filter (Issue #49) */}
            <div className="flex items-center gap-2 bg-white px-2 py-1.5 border border-gray-200 rounded-lg shadow-sm">
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="text-xs border-none focus:ring-0 text-gray-600 w-[110px]"
                title="Start Date"
              />
              <span className="text-gray-300 text-xs">-</span>
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="text-xs border-none focus:ring-0 text-gray-600 w-[110px]"
                title="End Date"
              />
              {(startDate || endDate) && (
                <button onClick={() => { setStartDate(""); setEndDate(""); }} className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-700 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="p-4 bg-white border-b border-gray-100 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <span className="text-green-600 font-medium">Income: PKR {statement.summary?.totalIncome?.toLocaleString() || 0}</span>
            <span className="text-red-500 font-medium">Expense: PKR {statement.summary?.totalExpense?.toLocaleString() || 0}</span>
            <span className="font-bold text-gray-900">Net: PKR {statement.summary?.net?.toLocaleString() || 0}</span>
          </div>
          
          <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              {["Date","Description","Category","Type","Amount","Running Balance"].map(h=><th key={h} className="text-left py-2 px-4 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {(()=>{
                // e.runningBalance is computed server-side from the account's
                // pre-filter opening balance forward through the sorted,
                // filtered entries — the correct value. Recomputing it here
                // from the account's *current* live balance was wrong
                // whenever a date filter or pagination was active, since
                // "current balance minus this page's net" isn't the balance
                // as of that historical entry.
                const entries: any[] = statement.entries || [];
                return entries.map((e:any)=>{
                  const snap = e.runningBalance ?? 0;
                  return (
                    <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-2 px-4 text-gray-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                      <td className="py-2 px-4 text-gray-900 max-w-xs truncate" title={e.description||e.partyName}>{e.description||e.partyName||"—"}</td>
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
              return entries.map((e:any)=>{
                const snap = e.runningBalance ?? 0;
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
          {(!statement.entries||statement.entries.length===0)&&<div className="text-center py-8 text-gray-400 text-sm">No transactions found in this period.</div>}
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
