"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ExportButton } from "@/components/export-button";
import { StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { BookOpen } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());
const TYPE_COLORS: Record<string,string> = { income:"bg-green-100 text-green-700", expense:"bg-red-100 text-red-700" };
const CATEGORIES = ["material_purchase","salary","maintenance","invoice_payment","client_payment","vendor_payment","utility","overhead","advance","other"];

export default function LedgerPage() {
  const { data: session } = useSession();
  const [page, setPage] = useState(1);
  const { data: entries, mutate, isLoading } = useSWR(`/api/ledger?page=${page}&limit=50`, fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);
  const { data: vendors } = useSWR("/api/vendors", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ type:"expense", category:"" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setSearch(q);
    }
  }, []);

  if (session && !["admin","ceo","accountant"].includes(session.user?.role||"")) {
    return <div className="p-6 text-center text-gray-500"><p className="text-4xl mb-2">&#x1F512;</p><p className="font-medium">Access Restricted</p></div>;
  }

  const canManage = ["admin","ceo","accountant"].includes(session?.user?.role||"");
  const list: any[] = entries?.data ? entries.data : (Array.isArray(entries) ? entries : []);
  
  const filtered = list.filter((e: any) => {
    const matchesType = !typeFilter || e.type === typeFilter;
    const matchesSearch = !search ||
      e.description?.toLowerCase().includes(search.toLowerCase()) ||
      e.referenceNumber?.toLowerCase().includes(search.toLowerCase()) ||
      (e.vendor?.name || e.partyName || "").toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const totalIncome = list.filter((e:any)=>e.type==="income").reduce((s:number,e:any)=>s+e.amount,0);
  const totalExpense = list.filter((e:any)=>e.type==="expense").reduce((s:number,e:any)=>s+e.amount,0);

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    if (!form.description?.trim()) { setError("Description is required."); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { setError("Enter a valid positive amount."); return; }
    if (!form.date) { setError("Date is required."); return; }
    if (new Date(form.date) > new Date()) { setError("Date cannot be in the future."); return; }
    if (!form.category?.trim()) { setError("Category is required."); return; }
    setLoading(true);
    try {
      const payload = {
        date: form.date,
        type: form.type || "expense",
        amount: parseFloat(form.amount),
        category: form.category,
        description: form.description || null,
        referenceNumber: form.referenceNumber || null,
        projectId: form.projectId || null,
        bankAccountId: form.bankAccountId || null,
        vendorId: form.vendorId || null,
        partyName: form.partyName || null,
        partyType: form.partyType || "other",
      };
      const res = await fetch("/api/ledger", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) });
      if (!res.ok) { const e = await res.json(); setError(e.error||"Failed to save entry"); return; }
      mutate(); setShowForm(false); setForm({ type:"expense", category:"", bankAccountId:"" });
    } finally { setLoading(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">General Ledger</h1>
          <p className="text-sm text-gray-500">{filtered.length} entries</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton module="ledger" />
          {canManage && <button onClick={()=>{setShowForm(!showForm);setError("");}} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ Add Entry</button>}
        </div>
      </div>

      {isLoading ? <StatsSkeleton count={3} /> : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 min-w-0">
          <p className="text-xs text-green-700 font-medium">Total Income</p>
          <p className="text-xl sm:text-2xl font-bold text-green-800 truncate" title={`PKR ${totalIncome.toLocaleString()}`}>PKR {totalIncome.toLocaleString()}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 min-w-0">
          <p className="text-xs text-red-700 font-medium">Total Expenses</p>
          <p className="text-xl sm:text-2xl font-bold text-red-800 truncate" title={`PKR ${totalExpense.toLocaleString()}`}>PKR {totalExpense.toLocaleString()}</p>
        </div>
        <div className={"border rounded-xl p-4 min-w-0 "+(totalIncome-totalExpense>=0?"bg-blue-50 border-blue-200":"bg-orange-50 border-orange-200")}>
          <p className={"text-xs font-medium "+(totalIncome-totalExpense>=0?"text-blue-700":"text-orange-700")}>Net Balance</p>
          <p className={"text-xl sm:text-2xl font-bold truncate "+(totalIncome-totalExpense>=0?"text-blue-800":"text-orange-800")} title={`PKR ${(totalIncome-totalExpense).toLocaleString()}`}>PKR {(totalIncome-totalExpense).toLocaleString()}</p>
        </div>
      </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}

      <div className="flex flex-wrap gap-3 items-center">
        {["","income","expense"].map(t=>(
          <button key={t} onClick={()=>setTypeFilter(t)} className={"px-3 py-1.5 text-sm rounded-lg capitalize transition-colors "+(typeFilter===t?"bg-blue-100 text-blue-700":"border border-gray-200 text-gray-600 hover:bg-gray-50")}>{t||"All"}</button>
        ))}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ledger..."
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full sm:w-56 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg">Add Ledger Entry</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <select value={form.type||"expense"} onChange={e=>setForm({...form,type:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
            <input type="number" step="0.01" value={form.amount||""} onChange={e=>setForm({...form,amount:e.target.value})} placeholder="Amount (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="text" required value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description *" className="sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select required value={form.category||""} onChange={e=>setForm({...form,category:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Category *</option>
              {CATEGORIES.map(c=><option key={c} value={c}>{c.replace(/_/g," ")}</option>)}
            </select>
            <input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.date||""} onChange={e=>setForm({...form,date:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select value={form.projectId||""} onChange={e=>setForm({...form,projectId:e.target.value||undefined})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">No Project (General)</option>
              {(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.bankAccountId||""} onChange={e=>setForm({...form,bankAccountId:e.target.value||undefined})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Bank Account (optional)</option>
              {(Array.isArray(bankAccounts)?bankAccounts:[]).map((b:any)=><option key={b.id} value={b.id}>{b.name} — PKR {(b.balance||0).toLocaleString()}</option>)}
            </select>
            
            <select value={form.vendorId||""} onChange={e=>setForm({...form,vendorId:e.target.value||undefined})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Vendor (optional)</option>
              {(Array.isArray(vendors)?vendors:[]).map((v:any)=><option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            
            <input type="text" value={form.partyName||""} onChange={e=>setForm({...form,partyName:e.target.value})} placeholder="Other Party Name (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />

            <input type="text" value={form.referenceNumber||""} onChange={e=>setForm({...form,referenceNumber:e.target.value})} placeholder="Reference / Voucher # (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Saving…":"Add Entry"}</button>
            <button type="button" onClick={()=>{setShowForm(false);setError("");}} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<BookOpen className="w-10 h-10" />} title="No ledger entries found" hint="Record income and expenses here to track your company finances." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Date","Type","Description","Category","Party / Vendor","Project","Reference #","Amount"].map(h=><th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((e:any)=>(
                  <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{e.date?new Date(e.date).toLocaleDateString():"-"}</td>
                    <td className="py-3 px-3"><span className={"text-xs px-2 py-0.5 rounded-full capitalize "+(TYPE_COLORS[e.type]||"bg-gray-100 text-gray-600")}>{e.type}</span></td>
                    <td className="py-3 px-3 text-gray-900" title={e.description}>{e.description||"—"}</td>
                    <td className="py-3 px-3 text-gray-500 capitalize">{e.category||"—"}</td>
                    <td className="py-3 px-3 text-gray-500">{e.vendor?.name || e.partyName || "—"}</td>
                    <td className="py-3 px-3 text-gray-500">{e.project?.name||"General"}</td>
                    <td className="py-3 px-3 text-gray-400 text-xs font-mono">{e.referenceNumber||"—"}</td>
                    <td className={"py-3 px-3 font-bold whitespace-nowrap "+(e.type==="income"?"text-green-700":"text-red-700")}>PKR {(e.amount||0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((e:any)=>(
              <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 break-words">{e.description||"—"}</p>
                    <p className="text-xs text-gray-500 whitespace-nowrap">{e.date?new Date(e.date).toLocaleDateString():"-"}</p>
                  </div>
                  <span className={"text-xs px-2 py-0.5 rounded-full capitalize shrink-0 "+(TYPE_COLORS[e.type]||"bg-gray-100 text-gray-600")}>{e.type}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <div><span className="text-gray-400">Category: </span><span className="text-gray-700 capitalize">{e.category||"—"}</span></div>
                  <div><span className="text-gray-400">Project: </span><span className="text-gray-700">{e.project?.name||"General"}</span></div>
                  <div><span className="text-gray-400">Party: </span><span className="text-gray-700">{e.vendor?.name || e.partyName || "—"}</span></div>
                  <div><span className="text-gray-400">Reference: </span><span className="text-gray-700 font-mono">{e.referenceNumber||"—"}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end">
                  <span className={"font-bold whitespace-nowrap "+(e.type==="income"?"text-green-700":"text-red-700")}>PKR {(e.amount||0).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Pagination Controls */}
      {entries?.pagination && entries.pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 pt-4 mt-6">
          <p className="text-sm text-gray-500">
            Showing page <span className="font-medium text-gray-900">{entries.pagination.page}</span> of <span className="font-medium text-gray-900">{entries.pagination.pages}</span> ({entries.pagination.total} total)
          </p>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setPage(p => Math.max(1, p - 1))} 
              disabled={entries.pagination.page === 1}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 disabled:opacity-50 hover:bg-gray-50"
            >
              Previous
            </button>
            <button 
              onClick={() => setPage(p => p + 1)} 
              disabled={entries.pagination.page >= entries.pagination.pages}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-700 disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
