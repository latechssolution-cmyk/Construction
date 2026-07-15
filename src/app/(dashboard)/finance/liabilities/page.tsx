"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton, StatsSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Scale, X, Lock, Wallet, Clock, Landmark } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { StatCard } from "@/components/ui/stat-card";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function LiabilitiesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: liabilities, mutate, isLoading } = useSWR("/api/liabilities", fetcher);
  const { data: stats, mutate: mutateStats } = useSWR("/api/liabilities/stats", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);
  const [statusFilter, setStatusFilter] = useState("");
  const [paidModal, setPaidModal] = useState<any>(null);
  const [paidBankId, setPaidBankId] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  if (session && !["admin","ceo","accountant"].includes(session.user?.role||"")) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-medium text-gray-700">Access Restricted</p>
        <p className="text-sm mt-1">You do not have permission to view this module.</p>
      </div>
    );
  }

  const canManage = ["admin","ceo","accountant"].includes(session?.user?.role||"");
  const list: any[] = Array.isArray(liabilities) ? liabilities : [];
  const filtered = list.filter((l:any)=>!statusFilter||l.liabilityStatus===statusFilter);

  const totalUnpaid = stats?.totalUnpaid ?? 0;
  const totalPaid = stats?.totalPaid ?? 0;
  const totalLiabilities = stats?.totalLiabilities ?? 0;

  async function confirmMarkPaid() {
    if (!paidModal) return;
    setActionLoading(true);
    try {
      const res = await fetch("/api/liabilities/"+paidModal.id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:true,bankAccountId:paidBankId||undefined})});
      if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.error || "Failed", variant: "destructive" }); return; }
      toast({ title: "Liability marked paid", description: `PKR ${(paidModal.grandTotal||0).toLocaleString()} settled` });
      setPaidModal(null); setPaidBankId("");
      mutate(); mutateStats();
    } finally { setActionLoading(false); }
  }

  async function markUnpaid(l: any) {
    const res = await fetch("/api/liabilities/"+l.id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({paid:false})});
    if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.error || "Failed", variant: "destructive" }); return; }
    toast({ title: "Liability marked unpaid", description: `${l.invoiceNumber} reopened` });
    mutate(); mutateStats();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Liabilities"
        subtitle={`${filtered.length} liabilit${filtered.length !== 1 ? "ies" : "y"} · money owed`}
      />

      {isLoading ? <StatsSkeleton count={3} /> : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Unpaid Liabilities" value={`PKR ${totalUnpaid.toLocaleString()}`} sub={stats?.unpaidCount ? `${stats.unpaidCount} outstanding` : undefined} tone="orange" icon={<Clock className="w-4 h-4" />} />
        <StatCard label="Paid Liabilities" value={`PKR ${totalPaid.toLocaleString()}`} tone="green" icon={<Wallet className="w-4 h-4" />} />
        <StatCard label="Total Liabilities" value={`PKR ${totalLiabilities.toLocaleString()}`} tone="gray" icon={<Landmark className="w-4 h-4" />} />
      </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex gap-1.5 flex-wrap bg-gray-100 p-1 rounded-lg w-fit">
          {[["","All"],["unpaid","Unpaid"],["paid","Paid"]].map(([val,lbl])=>(
            <button key={val} onClick={()=>setStatusFilter(val)} className={"px-3 py-1.5 text-sm rounded-md font-medium transition-colors "+(statusFilter===val?"bg-white text-gray-900 shadow-sm":"text-gray-500 hover:text-gray-700")}>{lbl}</button>
          ))}
        </div>
        <p className="text-xs text-gray-400">Flag an invoice as a liability from <span className="font-medium text-gray-500">Invoices → New Invoice</span>.</p>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Scale className="w-10 h-10" />} title="No liabilities found" hint="Create an invoice and tick 'Mark as liability' to track money the company owes here." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Reference","Owed To","Project","Issue Date","Amount","Status","Actions"].map(h=><th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((l:any)=>(
                  <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-mono text-xs text-gray-700">{l.invoiceNumber}</td>
                    <td className="py-3 px-3 font-medium text-gray-900">{l.client?.name||"—"}</td>
                    <td className="py-3 px-3 text-gray-500">{l.project?.name||"—"}</td>
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{l.issueDate?new Date(l.issueDate).toLocaleDateString():"—"}</td>
                    <td className="py-3 px-3 font-bold text-gray-900 whitespace-nowrap">PKR {(l.grandTotal||0).toLocaleString()}</td>
                    <td className="py-3 px-3"><StatusBadge status={l.liabilityStatus} /></td>
                    <td className="py-3 px-3">
                      <div className="flex gap-2 flex-wrap">
                        <a href={"/api/invoices/"+l.id+"/pdf"} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">PDF</a>
                        {canManage && l.liabilityStatus==="unpaid" && (
                          <button onClick={()=>{setPaidModal(l);setPaidBankId("");}} className="text-xs text-green-600 hover:underline font-medium">Mark Paid</button>
                        )}
                        {canManage && l.liabilityStatus==="paid" && (
                          <ConfirmDialog title="Mark as Unpaid?" message={"Reopen liability "+l.invoiceNumber+"? This reverses the recorded expense and restores any bank balance."} confirmLabel="Mark Unpaid" confirmClass="bg-orange-600 hover:bg-orange-700 text-white" onConfirm={()=>markUnpaid(l)}>
                            {open=><button onClick={open} className="text-xs text-orange-600 hover:underline font-medium">Mark Unpaid</button>}
                          </ConfirmDialog>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((l:any)=>(
              <div key={l.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gray-700">{l.invoiceNumber}</p>
                    <p className="font-semibold text-gray-900 truncate">{l.client?.name||"—"}</p>
                    {l.project?.name && <p className="text-xs text-gray-500 truncate">{l.project.name}</p>}
                  </div>
                  <StatusBadge status={l.liabilityStatus} className="shrink-0" />
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <div><span className="text-gray-400">Issued: </span><span className="text-gray-700 whitespace-nowrap">{l.issueDate?new Date(l.issueDate).toLocaleDateString():"—"}</span></div>
                  <div className="col-span-2"><span className="text-gray-400">Amount: </span><span className="text-gray-900 font-bold whitespace-nowrap">PKR {(l.grandTotal||0).toLocaleString()}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 flex-wrap">
                  <a href={"/api/invoices/"+l.id+"/pdf"} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">PDF</a>
                  {canManage && l.liabilityStatus==="unpaid" && (
                    <button onClick={()=>{setPaidModal(l);setPaidBankId("");}} className="text-xs text-green-600 hover:underline font-medium">Mark Paid</button>
                  )}
                  {canManage && l.liabilityStatus==="paid" && (
                    <ConfirmDialog title="Mark as Unpaid?" message={"Reopen liability "+l.invoiceNumber+"? This reverses the recorded expense and restores any bank balance."} confirmLabel="Mark Unpaid" confirmClass="bg-orange-600 hover:bg-orange-700 text-white" onConfirm={()=>markUnpaid(l)}>
                      {open=><button onClick={open} className="text-xs text-orange-600 hover:underline font-medium">Mark Unpaid</button>}
                    </ConfirmDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Mark Paid Modal */}
      {paidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Mark Liability Paid</h2>
                <p className="text-xs text-gray-500 mt-0.5">{paidModal.invoiceNumber} · PKR {(paidModal.grandTotal||0).toLocaleString()}</p>
              </div>
              <button onClick={()=>setPaidModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Paid From Bank Account</label>
                <select
                  value={paidBankId}
                  onChange={e=>setPaidBankId(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Not specified</option>
                  {(Array.isArray(bankAccounts)?bankAccounts:[]).map((b:any)=>(
                    <option key={b.id} value={b.id}>{b.name} — PKR {(b.balance||0).toLocaleString()}</option>
                  ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">Selecting an account debits it and logs the payment as an expense.</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmMarkPaid} disabled={actionLoading}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {actionLoading ? "Processing…" : "Confirm Payment"}
                </button>
                <button
                  onClick={()=>setPaidModal(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
