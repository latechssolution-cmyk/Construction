"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ExportButton } from "@/components/export-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Receipt, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());
const STATUS_COLORS: Record<string,string> = { draft:"bg-gray-100 text-gray-700", sent:"bg-blue-100 text-blue-700", paid:"bg-green-100 text-green-700", overdue:"bg-red-100 text-red-700", cancelled:"bg-orange-100 text-orange-700" };

export default function BillingPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: invoices, mutate, isLoading } = useSWR("/api/invoices", fetcher);
  const { data: clients } = useSWR("/api/clients", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ status:"draft", taxPercent:0 });
  const [items, setItems] = useState([{ description:"", quantity:1, unitPrice:0 }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [paidModal, setPaidModal] = useState<any>(null);
  const [paidBankId, setPaidBankId] = useState("");
  const [paidLoading, setPaidLoading] = useState(false);

  if (session && !["admin","ceo","accountant"].includes(session.user?.role||"")) {
    return <div className="p-6 text-center text-gray-500"><p className="text-4xl mb-2">&#x1F512;</p><p className="font-medium">Access Restricted</p><p className="text-sm mt-1">You do not have permission to view this module.</p></div>;
  }

  const canManage = ["admin","ceo","accountant"].includes(session?.user?.role||"");
  const list: any[] = Array.isArray(invoices) ? invoices : [];
  const filtered = list.filter((i:any)=>!statusFilter||i.status===statusFilter);

  function addItem() { setItems([...items,{description:"",quantity:1,unitPrice:0}]); }
  function updateItem(idx: number, field: string, val: any) { setItems(items.map((it,i)=>i===idx?{...it,[field]:val}:it)); }
  function removeItem(idx: number) { setItems(items.filter((_,i)=>i!==idx)); }

  const subtotal = items.reduce((s,it)=>s+it.quantity*it.unitPrice,0);
  const taxAmount = subtotal*(parseFloat(String(form.taxPercent||0))/100);
  const grandTotal = subtotal+taxAmount;

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(""); setSuccess("");
    if (form.dueDate && form.issueDate && new Date(form.dueDate) < new Date(form.issueDate)) { setError("Due date must be after issue date."); return; }
    if (items.every(it=>!it.description.trim())) { setError("Add at least one line item with a description."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/invoices",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,items})});
      if (!res.ok) { const e = await res.json(); setError(e.error||"Failed to create invoice"); return; }
      setSuccess("Invoice created successfully!");
      mutate(); setShowForm(false); setForm({status:"draft",taxPercent:0}); setItems([{description:"",quantity:1,unitPrice:0}]);
      setTimeout(()=>setSuccess(""),3000);
    } finally { setLoading(false); }
  }

  async function confirmMarkPaid() {
    if (!paidModal) return;
    setPaidLoading(true);
    try {
      const res = await fetch("/api/invoices/"+paidModal.id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"paid",bankAccountId:paidBankId||undefined})});
      if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.error || "Failed", variant: "destructive" }); return; }
      toast({ title: "Invoice marked paid", description: `PKR ${(paidModal.grandTotal||0).toLocaleString()} received` });
      setPaidModal(null); setPaidBankId("");
      mutate();
    } finally { setPaidLoading(false); }
  }
  async function markSent(id: string) {
    const res = await fetch("/api/invoices/"+id,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"sent"})});
    if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.error || "Failed", variant: "destructive" }); return; }
    mutate();
  }

  const totalPaid = list.filter((i:any)=>i.status==="paid").reduce((s:number,i:any)=>s+i.grandTotal,0);
  const totalPending = list.filter((i:any)=>["sent","overdue"].includes(i.status)).reduce((s:number,i:any)=>s+i.grandTotal,0);

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices &amp; Billing</h1>
          <p className="text-sm text-gray-500">{filtered.length} invoices</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton module="invoices" />
          {canManage && <button onClick={()=>setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ New Invoice</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-700 font-medium">Total Paid</p>
          <p className="text-2xl font-bold text-green-800">PKR {totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <p className="text-xs text-orange-700 font-medium">Pending Payment</p>
          <p className="text-2xl font-bold text-orange-800">PKR {totalPending.toLocaleString()}</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <p className="text-xs text-gray-600 font-medium">Total Invoiced</p>
          <p className="text-2xl font-bold text-gray-800">PKR {list.reduce((s:number,i:any)=>s+(i.grandTotal||0),0).toLocaleString()}</p>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">{success}</div>}

      <div className="flex gap-3 flex-wrap">
        {["","draft","sent","paid","overdue","cancelled"].map(s=>(
          <button key={s} onClick={()=>setStatusFilter(s)} className={"px-3 py-1.5 text-sm rounded-lg capitalize "+(statusFilter===s?"bg-blue-100 text-blue-700":"border border-gray-200 text-gray-600 hover:bg-gray-50")}>{s||"All"}</button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-lg">Create Invoice</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select required value={form.clientId||""} onChange={e=>setForm({...form,clientId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Client *</option>
              {(clients||[]).map((c:any)=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={form.projectId||""} onChange={e=>{const pid=e.target.value;const proj=(projects||[]).find((p:any)=>p.id===pid);setForm({...form,projectId:pid,clientId:proj?.clientId||form.clientId||""});}} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Project (opt)</option>
              {(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <select value={form.status||"draft"} onChange={e=>setForm({...form,status:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {["draft","sent","cancelled"].map(s=><option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Issue Date</label><input type="date" value={form.issueDate||""} onChange={e=>setForm({...form,issueDate:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Due Date</label><input type="date" value={form.dueDate||""} onChange={e=>setForm({...form,dueDate:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Tax %</label><input type="number" step="0.1" min="0" max="100" value={form.taxPercent||0} onChange={e=>setForm({...form,taxPercent:parseFloat(e.target.value||"0")})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            <div className="sm:col-span-3"><textarea value={form.notes||""} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Notes (optional)" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-medium text-sm">Line Items</h3>
              <button type="button" onClick={addItem} className="text-xs text-blue-600 hover:underline">+ Add Item</button>
            </div>
            {items.map((it,idx)=>(
              <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                <input value={it.description} onChange={e=>updateItem(idx,"description",e.target.value)} placeholder="Description *" className="col-span-2 sm:col-span-5 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                <input type="number" value={it.quantity} min="0" onChange={e=>updateItem(idx,"quantity",parseFloat(e.target.value)||0)} placeholder="Qty" className="col-span-1 sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                <input type="number" step="0.01" value={it.unitPrice} min="0" onChange={e=>updateItem(idx,"unitPrice",parseFloat(e.target.value)||0)} placeholder="Unit Price" className="col-span-1 sm:col-span-3 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                <span className="col-span-1 sm:col-span-1 text-sm font-medium text-gray-700 text-right whitespace-nowrap">PKR {(it.quantity*it.unitPrice).toLocaleString()}</span>
                {items.length>1 && <button type="button" onClick={()=>removeItem(idx)} className="col-span-1 sm:col-span-1 text-red-400 hover:text-red-600 text-center">&#x2715;</button>}
              </div>
            ))}
            <div className="border-t border-gray-200 pt-3 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-6 text-sm">
              <span className="text-gray-500">Subtotal: <strong>PKR {subtotal.toLocaleString()}</strong></span>
              <span className="text-gray-500">Tax ({form.taxPercent||0}%): <strong>PKR {taxAmount.toLocaleString()}</strong></span>
              <span className="text-gray-900 font-bold">Grand Total: PKR {grandTotal.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Creating...":"Create Invoice"}</button>
            <button type="button" onClick={()=>{setShowForm(false);setError("");}} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Receipt className="w-10 h-10" />} title="No invoices found" hint="Invoices are created when you bill a client for completed work." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Invoice #","Client","Project","Issue Date","Due Date","Amount","Status","Actions"].map(h=><th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv:any)=>(
                  <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
                    <td className="py-3 px-3 font-medium text-gray-900">{inv.client?.name||"&#x2014;"}</td>
                    <td className="py-3 px-3 text-gray-500">{inv.project?.name||"&#x2014;"}</td>
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{inv.issueDate?new Date(inv.issueDate).toLocaleDateString():"&#x2014;"}</td>
                    <td className={"py-3 px-3 whitespace-nowrap "+(inv.dueDate&&new Date(inv.dueDate)<new Date()&&inv.status!=="paid"?"text-red-500 font-medium":"text-gray-500")}>{inv.dueDate?new Date(inv.dueDate).toLocaleDateString():"&#x2014;"}</td>
                    <td className="py-3 px-3 font-bold text-gray-900 whitespace-nowrap">PKR {(inv.grandTotal||0).toLocaleString()}</td>
                    <td className="py-3 px-3"><span className={"text-xs px-2 py-0.5 rounded-full capitalize "+(STATUS_COLORS[inv.status]||"bg-gray-100 text-gray-600")}>{inv.status}</span></td>
                    <td className="py-3 px-3">
                      <div className="flex gap-2 flex-wrap">
                        <a href={"/api/invoices/"+inv.id+"/pdf"} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">PDF</a>
                        {canManage && inv.status==="draft" && (
                          <ConfirmDialog title="Mark as Sent?" message={"Send invoice "+inv.invoiceNumber+" to "+( inv.client?.name||"client")+"?"} confirmLabel="Mark Sent" confirmClass="bg-blue-600 hover:bg-blue-700 text-white" onConfirm={()=>markSent(inv.id)}>
                            {open=><button onClick={open} className="text-xs text-blue-600 hover:underline">Mark Sent</button>}
                          </ConfirmDialog>
                        )}
                        {canManage && ["sent","overdue"].includes(inv.status) && (
                          <button onClick={()=>{setPaidModal(inv);setPaidBankId("");}} className="text-xs text-green-600 hover:underline font-medium">Mark Paid</button>
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
            {filtered.map((inv:any)=>(
              <div key={inv.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-gray-700">{inv.invoiceNumber}</p>
                    <p className="font-semibold text-gray-900 truncate">{inv.client?.name||"&#x2014;"}</p>
                    {inv.project?.name && <p className="text-xs text-gray-500 truncate">{inv.project.name}</p>}
                  </div>
                  <span className={"text-xs px-2 py-0.5 rounded-full capitalize shrink-0 "+(STATUS_COLORS[inv.status]||"bg-gray-100 text-gray-600")}>{inv.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <div><span className="text-gray-400">Issued: </span><span className="text-gray-700 whitespace-nowrap">{inv.issueDate?new Date(inv.issueDate).toLocaleDateString():"&#x2014;"}</span></div>
                  <div><span className="text-gray-400">Due: </span><span className={"whitespace-nowrap "+(inv.dueDate&&new Date(inv.dueDate)<new Date()&&inv.status!=="paid"?"text-red-500 font-medium":"text-gray-700")}>{inv.dueDate?new Date(inv.dueDate).toLocaleDateString():"&#x2014;"}</span></div>
                  <div className="col-span-2"><span className="text-gray-400">Amount: </span><span className="text-gray-900 font-bold whitespace-nowrap">PKR {(inv.grandTotal||0).toLocaleString()}</span></div>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 flex-wrap">
                  <a href={"/api/invoices/"+inv.id+"/pdf"} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">PDF</a>
                  {canManage && inv.status==="draft" && (
                    <ConfirmDialog title="Mark as Sent?" message={"Send invoice "+inv.invoiceNumber+" to "+( inv.client?.name||"client")+"?"} confirmLabel="Mark Sent" confirmClass="bg-blue-600 hover:bg-blue-700 text-white" onConfirm={()=>markSent(inv.id)}>
                      {open=><button onClick={open} className="text-xs text-blue-600 hover:underline">Mark Sent</button>}
                    </ConfirmDialog>
                  )}
                  {canManage && ["sent","overdue"].includes(inv.status) && (
                    <button onClick={()=>{setPaidModal(inv);setPaidBankId("");}} className="text-xs text-green-600 hover:underline font-medium">Mark Paid</button>
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
                <h2 className="font-semibold text-gray-900">Mark Invoice Paid</h2>
                <p className="text-xs text-gray-500 mt-0.5">{paidModal.invoiceNumber} · PKR {(paidModal.grandTotal||0).toLocaleString()}</p>
              </div>
              <button onClick={()=>setPaidModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Received Into Bank Account</label>
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
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmMarkPaid} disabled={paidLoading}
                  className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {paidLoading ? "Processing…" : "Confirm Payment"}
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
