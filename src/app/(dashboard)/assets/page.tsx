"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useToast } from "@/hooks/use-toast";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Boxes, Pencil, Trash2, Landmark, TrendingDown, Wrench, AlertTriangle, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const pkr = (n: number) => `PKR ${Math.round(n || 0).toLocaleString()}`;

const CATEGORIES = ["land", "building", "vehicle", "machinery", "it_equipment", "furniture", "other"];
const STATUSES = ["in_use", "idle", "under_maintenance", "disposed"];
const label = (s: string) => s.replace(/_/g, " ");

const emptyForm = { name: "", assetCode: "", category: "machinery", purchaseCost: "", salvageValue: "", usefulLifeYears: "5", purchaseDate: "", status: "in_use", location: "", assignedTo: "", nextMaintenanceDate: "", notes: "" };

export default function AssetsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: assets, mutate, isLoading } = useSWR("/api/assets", fetcher);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  const canManage = ["admin", "ceo", "accountant"].includes(session?.user?.role || "");
  const canDelete = ["admin", "ceo"].includes(session?.user?.role || "");

  const list: any[] = Array.isArray(assets) ? assets : [];
  const now = Date.now();

  // Dashboard-parity summary computed from the same computed book values the API returns.
  const totalAssets = list.length;
  const totalValue = list.reduce((s, a) => s + (a.purchaseCost || 0), 0);
  const bookValue = list.reduce((s, a) => s + (a.currentBookValue || 0), 0);
  const idleOrMaint = list.filter((a) => ["idle", "under_maintenance"].includes(a.status)).length;
  const dueMaint = list.filter((a) => a.nextMaintenanceDate && new Date(a.nextMaintenanceDate).getTime() <= now && a.status !== "disposed").length;

  const filtered = list.filter((a) => (!categoryFilter || a.category === categoryFilter) && (!statusFilter || a.status === statusFilter));

  function openAdd() { setEditingId(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(a: any) {
    setEditingId(a.id);
    setForm({
      name: a.name || "", assetCode: a.assetCode || "", category: a.category || "machinery",
      purchaseCost: a.purchaseCost ?? "", salvageValue: a.salvageValue ?? "", usefulLifeYears: a.usefulLifeYears ?? "5",
      purchaseDate: a.purchaseDate ? a.purchaseDate.slice(0, 10) : "", status: a.status || "in_use",
      location: a.location || "", assignedTo: a.assignedTo || "",
      nextMaintenanceDate: a.nextMaintenanceDate ? a.nextMaintenanceDate.slice(0, 10) : "", notes: a.notes || "",
    });
    setShowForm(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast({ title: "Validation", description: "Asset name is required.", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const res = await fetch(editingId ? `/api/assets/${editingId}` : "/api/assets", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to save asset", variant: "destructive" }); return; }
      toast({ title: editingId ? "Asset updated" : "Asset added" });
      setShowForm(false);
      mutate();
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to delete", variant: "destructive" }); return; }
    toast({ title: "Asset deleted" });
    mutate();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Assets"
        subtitle="Fixed-asset register with straight-line depreciation and maintenance tracking."
        actions={canManage ? (
          <button onClick={openAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm transition-colors">+ Add Asset</button>
        ) : undefined}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="Total Assets" value={totalAssets} tone="blue" icon={<Boxes className="w-4 h-4" />} />
        <StatCard label="Total Value" value={pkr(totalValue)} tone="purple" icon={<Landmark className="w-4 h-4" />} />
        <StatCard label="Current Book Value" value={pkr(bookValue)} tone="green" icon={<TrendingDown className="w-4 h-4" />} sub="After depreciation" />
        <StatCard label="Idle / Maintenance" value={idleOrMaint} tone={idleOrMaint > 0 ? "orange" : "gray"} icon={<Wrench className="w-4 h-4" />} />
        <StatCard label="Due Maintenance" value={dueMaint} tone={dueMaint > 0 ? "red" : "green"} urgent={dueMaint > 0} icon={<AlertTriangle className="w-4 h-4" />} />
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{label(c)}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Statuses</option>
          {STATUSES.map((s) => <option key={s} value={s} className="capitalize">{label(s)}</option>)}
        </select>
      </div>

      {isLoading ? <TableSkeleton /> : filtered.length === 0 ? (
        <EmptyState icon={<Boxes className="w-10 h-10 text-gray-300" />} title="No assets yet" hint={canManage ? "Add your first fixed asset to start tracking book value and maintenance." : "No assets match your filters."} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                  <th className="text-left py-2.5 px-4 font-medium">Asset</th>
                  <th className="text-left py-2.5 px-4 font-medium">Category</th>
                  <th className="text-right py-2.5 px-4 font-medium">Purchase Cost</th>
                  <th className="text-right py-2.5 px-4 font-medium">Book Value</th>
                  <th className="text-left py-2.5 px-4 font-medium">Status</th>
                  <th className="text-left py-2.5 px-4 font-medium">Next Maintenance</th>
                  {canManage && <th className="text-right py-2.5 px-4 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((a) => {
                  const due = a.nextMaintenanceDate && new Date(a.nextMaintenanceDate).getTime() <= now && a.status !== "disposed";
                  return (
                    <tr key={a.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <p className="font-medium text-gray-900">{a.name}</p>
                        {a.assetCode && <p className="text-xs text-gray-400">{a.assetCode}</p>}
                      </td>
                      <td className="py-3 px-4 capitalize text-gray-600">{label(a.category)}</td>
                      <td className="py-3 px-4 text-right text-gray-800">{pkr(a.purchaseCost)}</td>
                      <td className="py-3 px-4 text-right font-medium text-green-700">{pkr(a.currentBookValue)}</td>
                      <td className="py-3 px-4"><StatusBadge status={a.status} /></td>
                      <td className="py-3 px-4">
                        {a.nextMaintenanceDate ? (
                          <span className={due ? "text-red-600 font-medium" : "text-gray-600"}>
                            {new Date(a.nextMaintenanceDate).toLocaleDateString()}{due && " · due"}
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      {canManage && (
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(a)} className="p-1.5 text-gray-400 hover:text-blue-600" title="Edit"><Pencil className="w-4 h-4" /></button>
                            {canDelete && (
                              <ConfirmDialog title="Delete asset" message={`Delete "${a.name}"? This cannot be undone.`} confirmLabel="Delete" onConfirm={() => remove(a.id)}>
                                {(open) => <button onClick={open} className="p-1.5 text-gray-400 hover:text-red-600" title="Delete"><Trash2 className="w-4 h-4" /></button>}
                              </ConfirmDialog>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-900">{editingId ? "Edit Asset" : "Add Asset"}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={save} className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name *</label>
                  <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="e.g., Toyota Hilux (LEB-1234)" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Asset Code</label>
                  <input value={form.assetCode} onChange={(e) => setForm({ ...form, assetCode: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="FA-0001" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm capitalize">
                    {CATEGORIES.map((c) => <option key={c} value={c}>{label(c)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Cost (PKR)</label>
                  <input type="number" min="0" step="0.01" value={form.purchaseCost} onChange={(e) => setForm({ ...form, purchaseCost: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Salvage Value (PKR)</label>
                  <input type="number" min="0" step="0.01" value={form.salvageValue} onChange={(e) => setForm({ ...form, salvageValue: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Useful Life (years)</label>
                  <input type="number" min="0" step="1" value={form.usefulLifeYears} onChange={(e) => setForm({ ...form, usefulLifeYears: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <p className="text-[11px] text-gray-400 mt-1">For non-depreciating assets (e.g. land) set life to 0.</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Purchase Date</label>
                  <input type="date" value={form.purchaseDate} onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm capitalize">
                    {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Next Maintenance</label>
                  <input type="date" value={form.nextMaintenanceDate} onChange={(e) => setForm({ ...form, nextMaintenanceDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Assigned To</label>
                  <input value={form.assignedTo} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Person / department" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? "Saving…" : editingId ? "Save Changes" : "Add Asset"}</button>
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
