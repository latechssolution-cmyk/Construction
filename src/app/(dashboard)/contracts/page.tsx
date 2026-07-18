"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { FileText, Pencil, Trash2, X, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ContractsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: contracts, mutate, isLoading } = useSWR("/api/contracts", fetcher);
  const { data: clients } = useSWR("/api/clients", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setSearch(q);
    }
  }, []);

  // Edit / Delete states
  const [editingContract, setEditingContract] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canManage = ["admin", "ceo", "manager"].includes(session?.user?.role || "");
  const canDelete = ["admin", "ceo"].includes(session?.user?.role || "");

  const filtered = (Array.isArray(contracts) ? contracts : []).filter((c: any) =>
    c.title?.toLowerCase().includes(search.toLowerCase()) || c.contractNumber?.toLowerCase().includes(search.toLowerCase())
  );

  async function updateStatus(id: string, status: string) {
    // Optimistic update — reflect the new status immediately instead of
    // waiting for the full contracts list (populated + cross-referenced
    // against projects) to re-fetch.
    mutate((current: any) => {
      const list = Array.isArray(current) ? current : [];
      return list.map((c: any) => (c.id === id ? { ...c, status } : c));
    }, { revalidate: false });

    const res = await fetch(`/api/contracts/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const e = await res.json();
      toast({ title: "Error", description: e.error || "Failed to update status", variant: "destructive" });
      mutate();
      return;
    }
    toast({ title: "Status updated" });
    mutate();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.contractValue && parseFloat(form.contractValue) < 0) {
      toast({ title: "Validation Error", description: "Contract value cannot be negative.", variant: "destructive" });
      return;
    }
    if (form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate)) {
      toast({ title: "Validation Error", description: "End date cannot be before start date.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to create contract", variant: "destructive" });
        return;
      }
      toast({ title: "Contract created", description: "The contract has been created successfully." });
      mutate();
      setShowForm(false);
      setForm({});
    } finally {
      setLoading(false);
    }
  }

  function startEdit(c: any) {
    setEditingContract(c);
    setEditForm({
      title: c.title,
      clientId: c.client?.id || c.clientId || "",
      contractValue: c.contractValue,
      startDate: c.startDate ? new Date(c.startDate).toISOString().slice(0, 10) : "",
      endDate: c.endDate ? new Date(c.endDate).toISOString().slice(0, 10) : "",
      scope: c.scope || "",
      paymentTerms: c.paymentTerms || "",
      status: c.status,
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editForm.contractValue && parseFloat(editForm.contractValue) < 0) {
      toast({ title: "Validation Error", description: "Contract value cannot be negative.", variant: "destructive" });
      return;
    }
    if (editForm.startDate && editForm.endDate && new Date(editForm.endDate) < new Date(editForm.startDate)) {
      toast({ title: "Validation Error", description: "End date cannot be before start date.", variant: "destructive" });
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/contracts/${editingContract.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to update contract", variant: "destructive" });
        return;
      }
      toast({ title: "Contract updated", description: "The contract details have been updated." });
      mutate();
      setEditingContract(null);
      setEditForm({});
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to terminate contract", variant: "destructive" });
      return;
    }
    toast({ title: "Contract terminated", description: "Contract status has been updated to terminated." });
    setConfirmDeleteId(null);
    mutate();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Contracts"
        subtitle={`${filtered.length} contract${filtered.length !== 1 ? "s" : ""}`}
        actions={canManage && (
          <button
            onClick={() => { setShowForm(!showForm); setEditingContract(null); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 shadow-sm"
          >
            {showForm ? "Cancel" : "+ New Contract"}
          </button>
        )}
      />

      <div className="relative w-full sm:w-80">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search contracts..."
          className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* New Contract Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">New Contract</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <input
                required
                value={form.title || ""}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Contract Title *"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <select
              required
              value={form.clientId || ""}
              onChange={e => setForm({ ...form, clientId: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Select Client *</option>
              {(Array.isArray(clients) ? clients : []).filter((c: any) => c.isActive !== false).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={form.contractValue || ""}
              onChange={e => setForm({ ...form, contractValue: e.target.value })}
              placeholder="Contract Value (PKR) *"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              type="date"
              value={form.startDate || ""}
              onChange={e => setForm({ ...form, startDate: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              type="date"
              value={form.endDate || ""}
              onChange={e => setForm({ ...form, endDate: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="sm:col-span-2">
              <textarea
                value={form.scope || ""}
                onChange={e => setForm({ ...form, scope: e.target.value })}
                placeholder="Scope of Work"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                value={form.paymentTerms || ""}
                onChange={e => setForm({ ...form, paymentTerms: e.target.value })}
                placeholder="Payment Terms"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading ? "Saving..." : "Create"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Edit Contract Modal/Form */}
      {editingContract && (
        <form onSubmit={handleEditSubmit} className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-blue-900">Edit Contract: {editingContract.contractNumber}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <input
                required
                value={editForm.title || ""}
                onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                placeholder="Contract Title *"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <select
              required
              value={editForm.clientId || ""}
              onChange={e => setEditForm({ ...editForm, clientId: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="">Select Client *</option>
              {(Array.isArray(clients) ? clients : []).filter((c: any) => c.isActive !== false).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={editForm.contractValue || ""}
              onChange={e => setEditForm({ ...editForm, contractValue: e.target.value })}
              placeholder="Contract Value (PKR) *"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              type="date"
              value={editForm.startDate || ""}
              onChange={e => setEditForm({ ...editForm, startDate: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              type="date"
              value={editForm.endDate || ""}
              onChange={e => setEditForm({ ...editForm, endDate: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="sm:col-span-2">
              <textarea
                value={editForm.scope || ""}
                onChange={e => setEditForm({ ...editForm, scope: e.target.value })}
                placeholder="Scope of Work"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="sm:col-span-2">
              <input
                value={editForm.paymentTerms || ""}
                onChange={e => setEditForm({ ...editForm, paymentTerms: e.target.value })}
                placeholder="Payment Terms"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={editLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">{editLoading ? "Saving..." : "Save Changes"}</button>
            <button type="button" onClick={() => { setEditingContract(null); setEditForm({}); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <CardGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<FileText className="w-10 h-10" />} title="No contracts found" hint={'Contracts define the legal agreements for your projects. Click "+ New Contract" to add one.'} />
      ) : (
        <div className="space-y-3">
          {filtered.map((c: any) => (
            <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-mono text-gray-400">{c.contractNumber}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <h3 className="font-semibold text-gray-900">{c.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Client: {c.client?.name || "—"}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-1.5">
                  <p className="font-bold text-blue-700 text-lg whitespace-nowrap">PKR {(c.contractValue || 0).toLocaleString()}</p>
                  {c.startDate && (
                    <p className="text-xs text-gray-400 whitespace-nowrap">
                      {new Date(c.startDate).toLocaleDateString()} – {c.endDate ? new Date(c.endDate).toLocaleDateString() : "ongoing"}
                    </p>
                  )}
                </div>
              </div>
              {c.scope && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{c.scope}</p>}
              {c.paymentTerms && <p className="text-xs text-gray-500 mt-1">Payment: {c.paymentTerms}</p>}

              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">{(c.projects || []).length} linked projects</p>
                <div className="flex items-center gap-3">
                  {canManage && (
                    <button
                      onClick={() => startEdit(c)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Contract"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  )}
                  {canManage && !["terminated", "cancelled"].includes(c.status) && (
                    <select
                      value={c.status}
                      onChange={e => updateStatus(c.id, e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    >
                      {["draft", "active", "on_hold", "completed", "cancelled", "terminated"].map(s => (
                        <option key={s} value={s}>{s.replace("_", " ")}</option>
                      ))}
                    </select>
                  )}
                  {canDelete && c.status !== "terminated" && (
                    confirmDeleteId === c.id ? (
                      <span className="inline-flex items-center gap-1.5 bg-red-50 px-2 py-1 rounded-md border border-red-200">
                        <span className="text-[10px] text-red-700 font-semibold uppercase">Terminate?</span>
                        <button onClick={() => handleDelete(c.id)} className="text-xs px-2 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 font-semibold">Yes</button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs px-2 py-0.5 border border-gray-200 bg-white text-gray-700 rounded hover:bg-gray-50">No</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(c.id)}
                        className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Terminate Contract"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
