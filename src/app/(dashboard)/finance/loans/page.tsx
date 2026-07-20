"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { useToast } from "@/hooks/use-toast";
import { HandCoins, Lock, Search, X, TrendingDown, CheckCircle2, Ban, Pencil, Trash2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());
const pkr = (n: number) => `PKR ${Math.round(n || 0).toLocaleString()}`;
const BORROWER_TYPES = ["employee", "vendor", "client", "partner", "other"];

export default function LoansPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: loans, mutate, isLoading } = useSWR("/api/loans", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ borrowerType: "employee" });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [repayModal, setRepayModal] = useState<any>(null);
  const [repayForm, setRepayForm] = useState<any>({});
  const [repayLoading, setRepayLoading] = useState(false);
  const [editModal, setEditModal] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [delBusy, setDelBusy] = useState(false);

  if (session && !["admin", "ceo", "accountant"].includes(session.user?.role || "")) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-medium text-gray-700">Access Restricted</p>
      </div>
    );
  }

  const list: any[] = Array.isArray(loans) ? loans : [];
  const filtered = list.filter((l: any) =>
    (!statusFilter || l.status === statusFilter) &&
    (l.borrowerName?.toLowerCase().includes(search.toLowerCase()) || l.borrowerType?.toLowerCase().includes(search.toLowerCase()))
  );
  const totalOutstanding = list.filter((l: any) => l.status !== "written_off").reduce((s: number, l: any) => s + (l.outstandingAmount || 0), 0);
  const totalIssued = list.reduce((s: number, l: any) => s + (l.principalAmount || 0), 0);
  const totalRepaid = list.reduce((s: number, l: any) => s + (l.repaidAmount || 0), 0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/loans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const err = await res.json(); toast({ title: "Error", description: err.error || "Failed to issue loan", variant: "destructive" }); return; }
      toast({ title: "Loan issued" });
      mutate(); setShowForm(false); setForm({ borrowerType: "employee" });
    } finally { setLoading(false); }
  }

  async function handleRepay(e: React.FormEvent) {
    e.preventDefault();
    setRepayLoading(true);
    try {
      const res = await fetch(`/api/loans/${repayModal.id}/repayments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(repayForm) });
      if (!res.ok) { const err = await res.json(); toast({ title: "Error", description: err.error || "Failed to record repayment", variant: "destructive" }); return; }
      toast({ title: "Repayment recorded" });
      mutate(); setRepayModal(null); setRepayForm({});
    } finally { setRepayLoading(false); }
  }

  async function writeOff(loan: any) {
    const res = await fetch(`/api/loans/${loan.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "written_off" }) });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to write off loan", variant: "destructive" }); return; }
    toast({ title: "Loan written off" });
    mutate();
  }

  const canWriteOff = ["admin", "ceo"].includes(session?.user?.role || "");
  // Edit/delete mirror the API gates: PUT is open to finance roles, DELETE
  // (which restores bank balances) is admin/ceo only.
  const canDelete = canWriteOff;

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editLoading) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/loans/${editModal.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editForm) });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to update loan", variant: "destructive" }); return; }
      toast({ title: "Loan updated" });
      mutate(); setEditModal(null); setEditForm({});
    } finally { setEditLoading(false); }
  }

  async function deleteLoan(id: string) {
    if (delBusy) return;
    setDelBusy(true);
    try {
      const res = await fetch(`/api/loans/${id}`, { method: "DELETE" });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to delete loan", variant: "destructive" }); return; }
      toast({ title: "Loan deleted", description: "Bank balances restored." });
      mutate(); setDeletingId(null);
    } finally { setDelBusy(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Loans"
        subtitle="Loans given to staff, vendors, clients, partners, or others."
        actions={<button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 shadow-sm">{showForm ? "Cancel" : "+ Issue Loan"}</button>}
      />

      {isLoading ? <StatsSkeleton count={3} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Total Outstanding" value={pkr(totalOutstanding)} tone={totalOutstanding > 0 ? "orange" : "green"} icon={<TrendingDown className="w-4 h-4" />} />
          <StatCard label="Total Issued (all time)" value={pkr(totalIssued)} tone="blue" icon={<HandCoins className="w-4 h-4" />} />
          <StatCard label="Total Repaid" value={pkr(totalRepaid)} tone="green" icon={<CheckCircle2 className="w-4 h-4" />} />
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by borrower..." className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="partially_repaid">Partially Repaid</option>
          <option value="repaid">Repaid</option>
          <option value="written_off">Written Off</option>
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Issue Loan</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <select value={form.borrowerType || "employee"} onChange={e => setForm({ ...form, borrowerType: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm capitalize">
              {BORROWER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <input required value={form.borrowerName || ""} onChange={e => setForm({ ...form, borrowerName: e.target.value })} placeholder="Borrower Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2" />
            <input required type="number" min="0.01" step="0.01" value={form.principalAmount || ""} onChange={e => setForm({ ...form, principalAmount: e.target.value })} placeholder="Loan Amount (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={form.issueDate || ""} onChange={e => setForm({ ...form, issueDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <input type="date" value={form.expectedReturnDate || ""} onChange={e => setForm({ ...form, expectedReturnDate: e.target.value })} placeholder="Expected return date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            <select value={form.bankAccountId || ""} onChange={e => setForm({ ...form, bankAccountId: e.target.value || undefined })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-3">
              <option value="">Bank Account (optional — debits the balance)</option>
              {(Array.isArray(bankAccounts) ? bankAccounts : []).map((b: any) => <option key={b.id} value={b.id}>{b.name} — PKR {(b.balance || 0).toLocaleString()}</option>)}
            </select>
            <textarea value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-3" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading ? "Saving..." : "Issue Loan"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<HandCoins className="w-10 h-10" />} title="No loans yet" hint="Loans given to employees, vendors, clients, partners, or others are tracked here, along with repayments." />
        </div>
      ) : (
        <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200 bg-gray-50">
              {["Borrower", "Type", "Issued", "Principal", "Repaid", "Outstanding", "Status", "Actions"].map(h => <th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((l: any) => (
                <tr key={l.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-medium text-gray-900">{l.borrowerName}</td>
                  <td className="py-3 px-3 text-gray-500 capitalize">{l.borrowerType}</td>
                  <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{new Date(l.issueDate).toLocaleDateString()}</td>
                  <td className="py-3 px-3 text-gray-800 whitespace-nowrap">{pkr(l.principalAmount)}</td>
                  <td className="py-3 px-3 text-green-600 whitespace-nowrap">{pkr(l.repaidAmount)}</td>
                  <td className="py-3 px-3 font-bold text-orange-600 whitespace-nowrap">{pkr(l.outstandingAmount)}</td>
                  <td className="py-3 px-3"><StatusBadge status={l.status} /></td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      {["active", "partially_repaid"].includes(l.status) && (
                        <button onClick={() => { setRepayModal(l); setRepayForm({}); }} className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 bg-green-50/50 hover:bg-green-50 font-medium">Record Repayment</button>
                      )}
                      {canWriteOff && ["active", "partially_repaid"].includes(l.status) && (
                        <button onClick={() => writeOff(l)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Write off"><Ban className="w-3.5 h-3.5" /></button>
                      )}
                      <button onClick={() => { setEditModal(l); setEditForm({ borrowerName: l.borrowerName, borrowerType: l.borrowerType, expectedReturnDate: l.expectedReturnDate ? String(l.expectedReturnDate).slice(0, 10) : "", notes: l.notes || "" }); }} className="p-1.5 text-blue-400 hover:bg-blue-50 rounded-lg" title="Edit loan"><Pencil className="w-3.5 h-3.5" /></button>
                      {canDelete && (
                        deletingId === l.id ? (
                          <span className="flex items-center gap-1.5">
                            <button onClick={() => deleteLoan(l.id)} disabled={delBusy} className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50">{delBusy ? "…" : "Confirm"}</button>
                            <button onClick={() => setDeletingId(null)} className="px-2 py-1 border border-gray-200 rounded text-xs text-gray-600 hover:bg-gray-50">✕</button>
                          </span>
                        ) : (
                          <button onClick={() => setDeletingId(l.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Delete loan (restores bank balances)"><Trash2 className="w-3.5 h-3.5" /></button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Edit Loan — {editModal.borrowerName}</h2>
              <button onClick={() => setEditModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleEdit} className="p-4 space-y-3">
              <p className="text-xs text-gray-400">Principal {pkr(editModal.principalAmount)} is fixed — delete and re-issue the loan if the amount is wrong.</p>
              <input required value={editForm.borrowerName || ""} onChange={e => setEditForm({ ...editForm, borrowerName: e.target.value })} placeholder="Borrower Name *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <select value={editForm.borrowerType || "employee"} onChange={e => setEditForm({ ...editForm, borrowerType: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm capitalize">
                {BORROWER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Expected Return Date</label>
                <input type="date" value={editForm.expectedReturnDate || ""} onChange={e => setEditForm({ ...editForm, expectedReturnDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <textarea value={editForm.notes || ""} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={editLoading} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{editLoading ? "Saving..." : "Save Changes"}</button>
                <button type="button" onClick={() => setEditModal(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {repayModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setRepayModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="font-semibold text-gray-900">Record Repayment — {repayModal.borrowerName}</h2>
              <button onClick={() => setRepayModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleRepay} className="p-4 space-y-3">
              <p className="text-xs text-gray-400">Outstanding: {pkr(repayModal.outstandingAmount)}</p>
              <input required type="number" min="0.01" step="0.01" max={repayModal.outstandingAmount} value={repayForm.amount || ""} onChange={e => setRepayForm({ ...repayForm, amount: e.target.value })} placeholder="Repayment Amount (PKR) *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input type="date" value={repayForm.date || ""} onChange={e => setRepayForm({ ...repayForm, date: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <select value={repayForm.bankAccountId || ""} onChange={e => setRepayForm({ ...repayForm, bankAccountId: e.target.value || undefined })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                <option value="">Bank Account (optional — credits the balance)</option>
                {(Array.isArray(bankAccounts) ? bankAccounts : []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <textarea value={repayForm.notes || ""} onChange={e => setRepayForm({ ...repayForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={repayLoading} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{repayLoading ? "Saving..." : "Record Repayment"}</button>
                <button type="button" onClick={() => setRepayModal(null)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
