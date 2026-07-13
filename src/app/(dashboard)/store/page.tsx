"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { PackageSearch, Pencil, Trash2, Plus, MinusCircle, X, History, Search, AlertTriangle } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";

const fetcher = (url: string) => fetch(url).then(r => r.json());

type ModalType = "edit" | "restock" | "use" | "delete" | "history" | null;

export default function StorePage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const { data: items, mutate, isLoading } = useSWR("/api/store", fetcher);
  const { data: vendors } = useSWR("/api/vendors", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<any>({ unit: "pcs", quantity: 0, minStockLevel: 5, unitPrice: 0 });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<any>(null);
  const [modalForm, setModalForm] = useState<any>({});
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  useEffect(() => {
    const q = searchParams.get("q");
    if (q) setSearch(q);
    setLowStockOnly(searchParams.get("lowStock") === "1");
  }, [searchParams]);

  const role = session?.user?.role || "";
  const canManage = ["admin", "ceo", "manager", "accountant"].includes(role);
  const canView = ["admin", "ceo", "manager", "accountant"].includes(role);
  const canDelete = ["admin", "ceo"].includes(role);

  if (session && !canView) {
    return <div className="p-6 text-center text-gray-500"><p className="text-4xl mb-2">🔒</p><p className="font-medium">Access Restricted</p></div>;
  }

  const list: any[] = Array.isArray(items) ? items : [];
  const filtered = list.filter((m: any) => {
    if (search && !m.itemName?.toLowerCase().includes(search.toLowerCase()) && !m.category?.toLowerCase().includes(search.toLowerCase())) return false;
    if (lowStockOnly && m.stockQuantity > m.minStockLevel) return false;
    return true;
  });
  const lowStockCount = list.filter((m: any) => m.stockQuantity <= m.minStockLevel).length;
  const totalValue = list.reduce((s: number, m: any) => s + (m.stockQuantity || 0) * (m.unitPrice || 0), 0);

  function openModal(type: ModalType, item: any) {
    setSelected(item);
    setModalError("");
    if (type === "edit") {
      setModalForm({
        itemName: item.itemName,
        category: item.category || "",
        unit: item.unit || "pcs",
        minStockLevel: item.minStockLevel ?? 5,
        vendorId: item.vendor?._id?.toString() || item.vendor?.id || "",
        notes: item.notes || "",
      });
    } else if (type === "restock") {
      setModalForm({
        restockQuantity: "",
        unitPrice: item.unitPrice ?? 0,
        vendorId: item.vendor?._id?.toString() || item.vendor?.id || "",
        bankAccountId: "",
        notes: "",
        receivedDate: new Date().toISOString().slice(0, 10),
      });
    } else if (type === "use") {
      setModalForm({ useQuantity: "", purpose: "", notes: "" });
    }
    setModal(type);
  }

  function closeModal() { setModal(null); setSelected(null); setModalForm({}); setModalError(""); }

  async function handleAdd(ev: React.FormEvent) {
    ev.preventDefault();
    setAddError("");
    if (!addForm.itemName?.trim()) { setAddError("Item name is required."); return; }
    if (parseFloat(addForm.unitPrice || 0) <= 0) { setAddError("Unit price must be greater than 0."); return; }
    if (parseFloat(addForm.minStockLevel || 0) < 0) { setAddError("Minimum stock level cannot be negative."); return; }
    if (parseFloat(addForm.quantity || 0) <= 0) { setAddError("Initial quantity must be greater than 0."); return; }
    setAddLoading(true);
    try {
      const res = await fetch("/api/store", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: addForm.itemName,
          category: addForm.category || "general",
          unit: addForm.unit || "pcs",
          quantity: parseFloat(addForm.quantity || 0),
          minStockLevel: parseFloat(addForm.minStockLevel || 5),
          unitPrice: parseFloat(addForm.unitPrice || 0),
          vendorId: addForm.vendorId || null,
          bankAccountId: addForm.bankAccountId || null,
          notes: addForm.notes || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); setAddError(e.error || "Failed to save"); return; }
      toast({ title: "Store item created" });
      mutate();
      setShowAddForm(false);
      setAddForm({ unit: "pcs", quantity: 0, minStockLevel: 5, unitPrice: 0 });
    } finally { setAddLoading(false); }
  }

  async function handleEdit() {
    if (!modalForm.itemName?.trim()) { setModalError("Name is required."); return; }
    if (parseFloat(modalForm.minStockLevel) < 0) { setModalError("Minimum stock level cannot be negative."); return; }
    setModalLoading(true);
    try {
      const res = await fetch(`/api/store/${selected.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: modalForm.itemName,
          category: modalForm.category,
          unit: modalForm.unit,
          minStockLevel: parseFloat(modalForm.minStockLevel),
          vendorId: modalForm.vendorId || null,
          notes: modalForm.notes,
        }),
      });
      if (!res.ok) { const e = await res.json(); setModalError(e.error || "Failed to update"); return; }
      toast({ title: "Store item updated" });
      mutate(); closeModal();
    } catch { setModalError("Network error"); } finally { setModalLoading(false); }
  }

  async function handleRestock() {
    const qty = parseFloat(modalForm.restockQuantity);
    if (!qty || qty <= 0) { setModalError("Enter a valid quantity to add."); return; }
    setModalLoading(true);
    try {
      const res = await fetch(`/api/store/${selected.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restockQuantity: qty,
          unitPrice: parseFloat(modalForm.unitPrice) || selected.unitPrice,
          vendorId: modalForm.vendorId || null,
          bankAccountId: modalForm.bankAccountId || null,
          notes: modalForm.notes,
          receivedDate: modalForm.receivedDate,
        }),
      });
      if (!res.ok) { const e = await res.json(); setModalError(e.error || "Failed to restock"); return; }
      toast({ title: "Stock replenished" });
      mutate(); closeModal();
    } catch { setModalError("Network error"); } finally { setModalLoading(false); }
  }

  async function handleUse() {
    const qty = parseFloat(modalForm.useQuantity);
    if (!qty || qty <= 0) { setModalError("Enter a valid quantity used."); return; }
    setModalLoading(true);
    try {
      const res = await fetch(`/api/store/${selected.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          useQuantity: qty,
          purpose: modalForm.purpose || null,
          notes: modalForm.notes || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); setModalError(e.error || "Failed to log usage"); return; }
      toast({ title: "Usage logged" });
      mutate(); closeModal();
    } catch { setModalError("Network error"); } finally { setModalLoading(false); }
  }

  async function handleDelete() {
    setModalLoading(true);
    try {
      const res = await fetch(`/api/store/${selected.id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setModalError(e.error || "Failed to delete item"); return; }
      toast({ title: "Store item deleted" });
      mutate(); closeModal();
    } finally { setModalLoading(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Store"
        subtitle={<>{filtered.length} items · PKR {totalValue.toLocaleString()} in stock{lowStockCount > 0 && <span className="text-red-500 font-medium"> · {lowStockCount} low stock</span>}</>}
        actions={<>
          {canManage && (
            <button onClick={() => { setShowAddForm(!showAddForm); setAddError(""); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          )}
        </>}
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative w-full sm:w-80">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or category..."
            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        <button onClick={() => setLowStockOnly(!lowStockOnly)}
          className={"px-3 py-1.5 text-sm rounded-lg font-medium flex items-center gap-1.5 transition-colors " + (lowStockOnly ? "bg-red-100 text-red-700" : "border border-gray-200 text-gray-600 hover:bg-gray-50")}>
          <AlertTriangle className="w-3.5 h-3.5" /> Low Stock Only
        </button>
      </div>

      {/* Add Item Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Add Store Item</h2>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          {addError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{addError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="text-xs text-gray-500 block mb-1">Item Name *</label>
              <input required value={addForm.itemName || ""} onChange={e => setAddForm({ ...addForm, itemName: e.target.value })}
                placeholder="e.g. Office Chairs, Safety Helmets" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Category</label>
              <input value={addForm.category || ""} onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                placeholder="e.g. Office, Safety, Tools" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Unit</label>
              <input value={addForm.unit || "pcs"} onChange={e => setAddForm({ ...addForm, unit: e.target.value })}
                placeholder="pcs, boxes, kg..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Initial Quantity *</label>
              <input type="number" step="0.01" min="0.01" value={addForm.quantity || 0} onChange={e => setAddForm({ ...addForm, quantity: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Unit Price (PKR) *</label>
              <input type="number" step="0.01" min="0.01" value={addForm.unitPrice || ""} onChange={e => setAddForm({ ...addForm, unitPrice: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Min Stock Level (reorder point)</label>
              <input type="number" step="0.01" min="0" value={addForm.minStockLevel || 5} onChange={e => setAddForm({ ...addForm, minStockLevel: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Supplier (optional)</label>
              <select value={addForm.vendorId || ""} onChange={e => setAddForm({ ...addForm, vendorId: e.target.value || undefined })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                <option value="">No Supplier</option>
                {(vendors || []).filter((v: any) => v.isActive !== false).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Paid From Account (optional)</label>
              <select value={addForm.bankAccountId || ""} onChange={e => setAddForm({ ...addForm, bankAccountId: e.target.value || undefined })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                <option value="">Not specified</option>
                {(bankAccounts || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="sm:col-span-3 bg-blue-50 rounded-lg px-4 py-2 text-sm text-blue-700">
              Total Cost: <strong>PKR {(parseFloat(addForm.quantity || 0) * parseFloat(addForm.unitPrice || 0)).toLocaleString()}</strong>
              <span className="text-blue-500 ml-2 text-xs">— will be recorded as an expense</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={addLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">
              {addLoading ? "Saving…" : "Add Item"}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setAddError(""); }}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<PackageSearch className="w-10 h-10" />} title="No store items found"
            hint="Track general company stock — office supplies, safety gear, tools — separate from project-specific materials." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Item", "Category", "Unit", "Unit Price", "In Stock", "Min Level", "Supplier", "Status", "Actions"].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m: any) => {
                  const isLow = m.stockQuantity <= m.minStockLevel;
                  return (
                    <tr key={m.id} className={"border-b border-gray-100 last:border-0 hover:bg-gray-50/50 transition-colors " + (isLow ? "bg-red-50/30" : "")}>
                      <td className="py-3 px-3 font-medium text-gray-900">{m.itemName}</td>
                      <td className="py-3 px-3 text-gray-500 capitalize">{m.category || "—"}</td>
                      <td className="py-3 px-3 text-gray-500">{m.unit || "—"}</td>
                      <td className="py-3 px-3 text-gray-700 whitespace-nowrap">PKR {(m.unitPrice || 0).toLocaleString()}</td>
                      <td className="py-3 px-3 whitespace-nowrap min-w-[110px]">
                        <p className={"font-bold " + (isLow ? "text-red-600" : "text-gray-900")}>{(m.stockQuantity || 0).toLocaleString()} {m.unit}</p>
                        <div className="w-20 h-1 bg-gray-100 rounded-full mt-1 overflow-hidden">
                          <div
                            className={"h-1 rounded-full " + (isLow ? "bg-red-500" : "bg-green-500")}
                            style={{ width: `${Math.min(100, m.minStockLevel > 0 ? ((m.stockQuantity || 0) / (m.minStockLevel * 2)) * 100 : 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{(m.minStockLevel || 0).toLocaleString()} {m.unit}</td>
                      <td className="py-3 px-3 text-gray-500">{m.vendor?.name || "—"}</td>
                      <td className="py-3 px-3">
                        {isLow
                          ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium"><AlertTriangle className="w-3 h-3" /> Low</span>
                          : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">OK</span>}
                      </td>
                      {canManage && (
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-1">
                            <button title="Add Stock / Restock" onClick={() => openModal("restock", m)}
                              className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors" >
                              <Plus className="w-4 h-4" />
                            </button>
                            <button title="Log Usage / Consume" onClick={() => openModal("use", m)}
                              className="p-1.5 text-orange-500 hover:bg-orange-50 rounded-lg transition-colors">
                              <MinusCircle className="w-4 h-4" />
                            </button>
                            <button title="View Usage History" onClick={() => openModal("history", m)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                              <History className="w-4 h-4" />
                            </button>
                            <button title="Edit" onClick={() => openModal("edit", m)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            {canDelete && (
                              <button title="Delete" onClick={() => openModal("delete", m)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                      {!canManage && <td className="py-3 px-3" />}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((m: any) => {
              const isLow = m.stockQuantity <= m.minStockLevel;
              return (
                <div key={m.id} className={"bg-white border border-gray-200 rounded-xl p-4 shadow-sm " + (isLow ? "border-red-200" : "")}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{m.itemName}</p>
                      <p className="text-xs text-gray-500 capitalize">{m.category || "—"}{m.unit ? ` · ${m.unit}` : ""}</p>
                    </div>
                    {isLow
                      ? <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium shrink-0"><AlertTriangle className="w-3 h-3" /> Low</span>
                      : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium shrink-0">OK</span>}
                  </div>
                  <div className="mt-3">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={"h-1.5 rounded-full " + (isLow ? "bg-red-500" : "bg-green-500")}
                        style={{ width: `${Math.min(100, m.minStockLevel > 0 ? ((m.stockQuantity || 0) / (m.minStockLevel * 2)) * 100 : 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                    <div><span className="text-gray-400">Unit Price: </span><span className="text-gray-700">PKR {(m.unitPrice || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-400">In Stock: </span><span className={"font-medium " + (isLow ? "text-red-600" : "text-gray-900")}>{(m.stockQuantity || 0).toLocaleString()} {m.unit}</span></div>
                    <div><span className="text-gray-400">Min Level: </span><span className="text-gray-700">{(m.minStockLevel || 0).toLocaleString()} {m.unit}</span></div>
                    <div><span className="text-gray-400">Supplier: </span><span className="text-gray-700">{m.vendor?.name || "—"}</span></div>
                  </div>
                  {canManage && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button onClick={() => openModal("restock", m)}
                        className="flex-1 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors">
                        + Stock
                      </button>
                      <button onClick={() => openModal("use", m)}
                        className="flex-1 py-1.5 text-xs bg-orange-50 text-orange-700 rounded-lg font-medium hover:bg-orange-100 transition-colors">
                        Consume
                      </button>
                      <button onClick={() => openModal("history", m)}
                        className="px-2.5 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg font-medium hover:bg-purple-100 transition-colors">
                        <History className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => openModal("edit", m)}
                        className="px-2.5 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {canDelete && (
                        <button onClick={() => openModal("delete", m)}
                          className="px-2.5 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── MODALS ── */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            {/* Edit Modal */}
            {modal === "edit" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Edit Item</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-gray-500">Update details for <strong>{selected?.itemName}</strong>.</p>
                {modalError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{modalError}</div>}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Item Name *</label>
                    <input value={modalForm.itemName || ""} onChange={e => setModalForm({ ...modalForm, itemName: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Category</label>
                      <input value={modalForm.category || ""} onChange={e => setModalForm({ ...modalForm, category: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Unit</label>
                      <input value={modalForm.unit || ""} onChange={e => setModalForm({ ...modalForm, unit: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Min Stock Level</label>
                      <input type="number" step="0.01" min="0" value={modalForm.minStockLevel ?? ""} onChange={e => setModalForm({ ...modalForm, minStockLevel: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Supplier</label>
                      <select value={modalForm.vendorId || ""} onChange={e => setModalForm({ ...modalForm, vendorId: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                        <option value="">None</option>
                        {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notes</label>
                    <textarea value={modalForm.notes || ""} onChange={e => setModalForm({ ...modalForm, notes: e.target.value })} rows={2}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleEdit} disabled={modalLoading}
                    className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">
                    {modalLoading ? "Saving…" : "Save Changes"}
                  </button>
                  <button onClick={closeModal} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {/* Restock Modal */}
            {modal === "restock" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Add Stock</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                  <span className="font-medium">{selected?.itemName}</span>
                  <span className="text-gray-500 ml-2">Current stock: <strong className={selected?.stockQuantity <= selected?.minStockLevel ? "text-red-600" : "text-gray-900"}>{selected?.stockQuantity} {selected?.unit}</strong></span>
                </div>
                {modalError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{modalError}</div>}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Quantity Received *</label>
                      <input type="number" step="0.01" min="0.01" value={modalForm.restockQuantity || ""} onChange={e => setModalForm({ ...modalForm, restockQuantity: e.target.value })}
                        placeholder={`In ${selected?.unit || "units"}`}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Unit Price (PKR)</label>
                      <input type="number" step="0.01" min="0" value={modalForm.unitPrice || ""} onChange={e => setModalForm({ ...modalForm, unitPrice: e.target.value })}
                        placeholder={`Last: PKR ${(selected?.unitPrice || 0).toLocaleString()}`}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40" />
                    </div>
                  </div>
                  {modalForm.restockQuantity > 0 && modalForm.unitPrice > 0 && (
                    <div className="bg-green-50 rounded-lg px-4 py-2 text-sm text-green-700">
                      Total cost of this delivery: <strong>PKR {(parseFloat(modalForm.restockQuantity || 0) * parseFloat(modalForm.unitPrice || 0)).toLocaleString()}</strong>
                      <span className="text-green-500 ml-2 text-xs">— will be recorded as an expense</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Received Date</label>
                      <input type="date" max={new Date().toISOString().slice(0, 10)} value={modalForm.receivedDate || ""} onChange={e => setModalForm({ ...modalForm, receivedDate: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Supplier (optional)</label>
                      <select value={modalForm.vendorId || ""} onChange={e => setModalForm({ ...modalForm, vendorId: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40">
                        <option value="">None</option>
                        {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 block mb-1">Paid From Account (optional)</label>
                      <select value={modalForm.bankAccountId || ""} onChange={e => setModalForm({ ...modalForm, bankAccountId: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40">
                        <option value="">Not specified</option>
                        {(bankAccounts || []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notes</label>
                    <input value={modalForm.notes || ""} onChange={e => setModalForm({ ...modalForm, notes: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500/40" />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleRestock} disabled={modalLoading}
                    className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-green-700 transition-colors">
                    {modalLoading ? "Saving…" : "Add to Stock"}
                  </button>
                  <button onClick={closeModal} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {/* Use / Consume Modal */}
            {modal === "use" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg">Log Usage</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                  <span className="font-medium">{selected?.itemName}</span>
                  <span className="text-gray-500 ml-2">Available: <strong className={selected?.stockQuantity <= selected?.minStockLevel ? "text-red-600" : "text-gray-900"}>{selected?.stockQuantity} {selected?.unit}</strong></span>
                </div>
                {modalError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{modalError}</div>}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Quantity Used * ({selected?.unit})</label>
                    <input type="number" step="0.01" min="0.01" max={selected?.stockQuantity} value={modalForm.useQuantity || ""}
                      onChange={e => setModalForm({ ...modalForm, useQuantity: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Purpose / Department</label>
                    <input value={modalForm.purpose || ""} onChange={e => setModalForm({ ...modalForm, purpose: e.target.value })}
                      placeholder="e.g. Site office, HQ maintenance"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notes</label>
                    <input value={modalForm.notes || ""} onChange={e => setModalForm({ ...modalForm, notes: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  </div>
                  {modalForm.useQuantity > 0 && (
                    <div className="bg-orange-50 rounded-lg px-4 py-2 text-sm text-orange-700">
                      Stock after this: <strong>{Math.max(0, (selected?.stockQuantity || 0) - parseFloat(modalForm.useQuantity || 0)).toLocaleString()} {selected?.unit}</strong>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleUse} disabled={modalLoading}
                    className="flex-1 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-orange-600 transition-colors">
                    {modalLoading ? "Logging…" : "Log Usage"}
                  </button>
                  <button onClick={closeModal} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </div>
            )}

            {/* History Modal */}
            {modal === "history" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div>
                    <h2 className="font-semibold text-lg text-gray-900 flex items-center gap-1.5">
                      <History className="w-5 h-5 text-purple-600" />
                      Usage History
                    </h2>
                    <p className="text-xs text-gray-400 font-medium">{selected?.itemName}</p>
                  </div>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                {!Array.isArray(selected?.usageLogs) || selected.usageLogs.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-sm">No usage history logged for this item.</div>
                ) : (
                  <div className="max-h-60 overflow-y-auto border border-gray-100 rounded-lg">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 sticky top-0 border-b border-gray-100">
                        <tr>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">Date</th>
                          <th className="text-right py-2 px-3 text-gray-500 font-medium">Quantity</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">User</th>
                          <th className="text-left py-2 px-3 text-gray-500 font-medium">Purpose</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {selected.usageLogs.map((log: any) => (
                          <tr key={log._id || log.id} className="hover:bg-gray-50/50">
                            <td className="py-2 px-3 text-gray-600 font-medium">{formatDate(log.date)}</td>
                            <td className="py-2 px-3 text-right text-gray-900 font-bold">{(log.quantityUsed || 0).toLocaleString()} {selected.unit}</td>
                            <td className="py-2 px-3 text-gray-500">{log.usedBy?.name || "—"}</td>
                            <td className="py-2 px-3 text-gray-500 truncate max-w-[120px]" title={log.purpose || log.notes || ""}>
                              {log.purpose || log.notes || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div className="flex justify-end pt-2 border-t border-gray-100">
                  <button onClick={closeModal} className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors">Close</button>
                </div>
              </div>
            )}

            {/* Delete Modal */}
            {modal === "delete" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg text-red-600">Delete Item</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete <strong>{selected?.itemName}</strong>? This cannot be undone.
                  All usage history for this item will also be removed.
                </p>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleDelete} disabled={modalLoading}
                    className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-red-700 transition-colors">
                    {modalLoading ? "Deleting…" : "Yes, Delete"}
                  </button>
                  <button onClick={closeModal} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
