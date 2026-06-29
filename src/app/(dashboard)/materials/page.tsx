"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ExportButton } from "@/components/export-button";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Package, Pencil, Trash2, Plus, MinusCircle, ChevronDown, ChevronUp, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());
const fmt = (n: number) => `PKR ${(n || 0).toLocaleString()}`;

type ModalType = "edit" | "restock" | "use" | "delete" | "history" | null;

export default function MaterialsPage() {
  const { data: session } = useSession();
  const { data: materials, mutate, isLoading } = useSWR("/api/materials", fetcher);
  const { data: vendors } = useSWR("/api/vendors", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<any>({ unit: "bags", quantity: 0, minStockLevel: 5, unitPrice: 0 });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [modal, setModal] = useState<ModalType>(null);
  const [selected, setSelected] = useState<any>(null);
  const [modalForm, setModalForm] = useState<any>({});
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState("");

  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const canManage = ["admin", "manager"].includes(session?.user?.role || "");
  const canView = ["admin", "ceo", "manager"].includes(session?.user?.role || "");

  if (session && !canView) {
    return <div className="p-6 text-center text-gray-500"><p className="text-4xl mb-2">🔒</p><p className="font-medium">Access Restricted</p></div>;
  }

  const list: any[] = Array.isArray(materials) ? materials : [];
  const filtered = list.filter((m: any) => {
    if (search && !m.itemName?.toLowerCase().includes(search.toLowerCase()) && !m.category?.toLowerCase().includes(search.toLowerCase())) return false;
    if (lowStockOnly && m.stockQuantity > m.minStockLevel) return false;
    return true;
  });
  const lowStockCount = list.filter((m: any) => m.stockQuantity <= m.minStockLevel).length;

  function openModal(type: ModalType, material: any) {
    setSelected(material);
    setModalError("");
    if (type === "edit") {
      setModalForm({
        itemName: material.itemName,
        category: material.category || "",
        unit: material.unit || "bags",
        minStockLevel: material.minStockLevel ?? 5,
        vendorId: material.vendor?._id?.toString() || material.vendor?.id || "",
        notes: material.notes || "",
      });
    } else if (type === "restock") {
      setModalForm({
        restockQuantity: "",
        unitPrice: material.unitPrice ?? 0,
        vendorId: material.vendor?._id?.toString() || material.vendor?.id || "",
        bankAccountId: "",
        notes: "",
        receivedDate: new Date().toISOString().slice(0, 10),
      });
    } else if (type === "use") {
      setModalForm({ quantityUsed: "", purpose: "", notes: "", date: new Date().toISOString().slice(0, 10) });
    }
    setModal(type);
  }

  function closeModal() { setModal(null); setSelected(null); setModalForm({}); setModalError(""); }

  async function handleAdd(ev: React.FormEvent) {
    ev.preventDefault();
    setAddError("");
    if (!addForm.itemName?.trim()) { setAddError("Material name is required."); return; }
    if (!addForm.projectId) { setAddError("Please select a project."); return; }
    setAddLoading(true);
    try {
      const res = await fetch("/api/materials", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: addForm.itemName,
          category: addForm.category || "general",
          unit: addForm.unit || "bags",
          quantity: parseFloat(addForm.quantity || 0),
          minStockLevel: parseFloat(addForm.minStockLevel || 5),
          unitPrice: parseFloat(addForm.unitPrice || 0),
          projectId: addForm.projectId,
          vendorId: addForm.vendorId || null,
          bankAccountId: addForm.bankAccountId || null,
          notes: addForm.notes || null,
        }),
      });
      if (!res.ok) { const e = await res.json(); setAddError(e.error || "Failed to save"); return; }
      mutate();
      setShowAddForm(false);
      setAddForm({ unit: "bags", quantity: 0, minStockLevel: 5, unitPrice: 0 });
    } finally { setAddLoading(false); }
  }

  async function handleEdit() {
    if (!modalForm.itemName?.trim()) { setModalError("Name is required."); return; }
    setModalLoading(true);
    try {
      const res = await fetch(`/api/materials/${selected.id}`, {
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
      mutate(); closeModal();
    } catch { setModalError("Network error"); } finally { setModalLoading(false); }
  }

  async function handleRestock() {
    const qty = parseFloat(modalForm.restockQuantity);
    if (!qty || qty <= 0) { setModalError("Enter a valid quantity to add."); return; }
    setModalLoading(true);
    try {
      const res = await fetch(`/api/materials/${selected.id}`, {
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
      mutate(); closeModal();
    } catch { setModalError("Network error"); } finally { setModalLoading(false); }
  }

  async function handleUse() {
    const qty = parseFloat(modalForm.quantityUsed);
    if (!qty || qty <= 0) { setModalError("Enter a valid quantity used."); return; }
    setModalLoading(true);
    try {
      const res = await fetch("/api/material-usage", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialId: selected.id,
          quantityUsed: qty,
          purpose: modalForm.purpose || null,
          notes: modalForm.notes || null,
          date: modalForm.date,
        }),
      });
      if (!res.ok) { const e = await res.json(); setModalError(e.error || "Failed to log usage"); return; }
      mutate(); closeModal();
    } catch { setModalError("Network error"); } finally { setModalLoading(false); }
  }

  async function handleDelete() {
    setModalLoading(true);
    try {
      const res = await fetch(`/api/materials/${selected.id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json().catch(() => ({})); setModalError(e.error || "Failed to delete material"); return; }
      mutate(); closeModal();
    } finally { setModalLoading(false); }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Materials</h1>
          <p className="text-sm text-gray-500">
            {filtered.length} items
            {lowStockCount > 0 && <span className="text-red-500 font-medium"> · {lowStockCount} low stock</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ExportButton module="materials" />
          {canManage && (
            <button onClick={() => { setShowAddForm(!showAddForm); setAddError(""); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Material
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap items-center">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or category..."
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        <button onClick={() => setLowStockOnly(!lowStockOnly)}
          className={"px-3 py-1.5 text-sm rounded-lg " + (lowStockOnly ? "bg-red-100 text-red-700" : "border border-gray-200 text-gray-600 hover:bg-gray-50")}>
          ⚠️ Low Stock Only
        </button>
      </div>

      {/* Add Material Form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">Add New Material</h2>
            <button type="button" onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
          </div>
          {addError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{addError}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="col-span-3">
              <label className="text-xs text-gray-500 block mb-1">Material Name *</label>
              <input required value={addForm.itemName || ""} onChange={e => setAddForm({ ...addForm, itemName: e.target.value })}
                placeholder="e.g. Portland Cement, Steel Bars" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Project *</label>
              <select required value={addForm.projectId || ""} onChange={e => setAddForm({ ...addForm, projectId: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                <option value="">Select Project</option>
                {(projects || []).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Category</label>
              <input value={addForm.category || ""} onChange={e => setAddForm({ ...addForm, category: e.target.value })}
                placeholder="e.g. Cement, Steel, Bricks" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Unit</label>
              <input value={addForm.unit || "bags"} onChange={e => setAddForm({ ...addForm, unit: e.target.value })}
                placeholder="bags, kg, pcs, ton..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Initial Quantity Received</label>
              <input type="number" step="0.01" min="0" value={addForm.quantity || 0} onChange={e => setAddForm({ ...addForm, quantity: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Unit Price (PKR)</label>
              <input type="number" step="0.01" min="0" value={addForm.unitPrice || 0} onChange={e => setAddForm({ ...addForm, unitPrice: e.target.value })}
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
              <span className="text-blue-500 ml-2 text-xs">— will be recorded as an expense in the ledger</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={addLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">
              {addLoading ? "Saving…" : "Add Material"}
            </button>
            <button type="button" onClick={() => { setShowAddForm(false); setAddError(""); }}
              className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Materials Table */}
      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Package className="w-10 h-10" />} title="No materials found"
            hint="Track construction materials — cement, steel, bricks and more — with stock levels and reorder alerts." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Material", "Category", "Unit", "Unit Price", "In Stock", "Min Level", "Project", "Supplier", "Status", "Actions"].map(h => (
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
                      <td className={"py-3 px-3 font-bold whitespace-nowrap " + (isLow ? "text-red-600" : "text-gray-900")}>
                        {(m.stockQuantity || 0).toLocaleString()} {m.unit}
                      </td>
                      <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{(m.minStockLevel || 0).toLocaleString()} {m.unit}</td>
                      <td className="py-3 px-3 text-gray-500">{m.project?.name || "—"}</td>
                      <td className="py-3 px-3 text-gray-500">{m.vendor?.name || "—"}</td>
                      <td className="py-3 px-3">
                        {isLow
                          ? <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium">⚠ Low</span>
                          : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full">OK</span>}
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
                            <button title="Edit" onClick={() => openModal("edit", m)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button title="Delete" onClick={() => openModal("delete", m)}
                              className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
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
                      ? <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-medium shrink-0">⚠ Low</span>
                      : <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full shrink-0">OK</span>}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                    <div><span className="text-gray-400">Unit Price: </span><span className="text-gray-700">PKR {(m.unitPrice || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-400">In Stock: </span><span className={"font-medium " + (isLow ? "text-red-600" : "text-gray-900")}>{(m.stockQuantity || 0).toLocaleString()} {m.unit}</span></div>
                    <div><span className="text-gray-400">Min Level: </span><span className="text-gray-700">{(m.minStockLevel || 0).toLocaleString()} {m.unit}</span></div>
                    <div><span className="text-gray-400">Project: </span><span className="text-gray-700">{m.project?.name || "—"}</span></div>
                    <div><span className="text-gray-400">Supplier: </span><span className="text-gray-700">{m.vendor?.name || "—"}</span></div>
                  </div>
                  {canManage && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                      <button onClick={() => openModal("restock", m)}
                        className="flex-1 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg font-medium hover:bg-green-100 transition-colors">
                        + Add Stock
                      </button>
                      <button onClick={() => openModal("use", m)}
                        className="flex-1 py-1.5 text-xs bg-orange-50 text-orange-700 rounded-lg font-medium hover:bg-orange-100 transition-colors">
                        Log Usage
                      </button>
                      <button onClick={() => openModal("edit", m)}
                        className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg font-medium hover:bg-blue-100 transition-colors">
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button onClick={() => openModal("delete", m)}
                        className="px-3 py-1.5 text-xs bg-red-50 text-red-600 rounded-lg font-medium hover:bg-red-100 transition-colors">
                        <Trash2 className="w-3 h-3" />
                      </button>
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
                  <h2 className="font-semibold text-lg">Edit Material</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-gray-500">Update the details for <strong>{selected?.itemName}</strong>. To add more stock, use the "Add Stock" button instead.</p>
                {modalError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{modalError}</div>}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Material Name *</label>
                    <input value={modalForm.itemName || ""} onChange={e => setModalForm({ ...modalForm, itemName: e.target.value })}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Category</label>
                      <input value={modalForm.category || ""} onChange={e => setModalForm({ ...modalForm, category: e.target.value })}
                        placeholder="Cement, Steel..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Unit</label>
                      <input value={modalForm.unit || ""} onChange={e => setModalForm({ ...modalForm, unit: e.target.value })}
                        placeholder="bags, kg, pcs..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
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
                <p className="text-sm text-gray-500">Record a new delivery of this material. You can set the new price if it has changed since the last purchase.</p>
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
                      <input type="date" value={modalForm.receivedDate || ""} onChange={e => setModalForm({ ...modalForm, receivedDate: e.target.value })}
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
                      placeholder="e.g. Delivery from supplier, batch #123"
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
                  <h2 className="font-semibold text-lg">Log Material Usage</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
                  <span className="font-medium">{selected?.itemName}</span>
                  <span className="text-gray-500 ml-2">Available: <strong className={selected?.stockQuantity <= selected?.minStockLevel ? "text-red-600" : "text-gray-900"}>{selected?.stockQuantity} {selected?.unit}</strong></span>
                </div>
                <p className="text-sm text-gray-500">Record how much of this material was used on the site. The stock will be reduced automatically.</p>
                {modalError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{modalError}</div>}
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Quantity Used * ({selected?.unit})</label>
                      <input type="number" step="0.01" min="0.01" max={selected?.stockQuantity} value={modalForm.quantityUsed || ""}
                        onChange={e => setModalForm({ ...modalForm, quantityUsed: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Date Used</label>
                      <input type="date" value={modalForm.date || ""} onChange={e => setModalForm({ ...modalForm, date: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Purpose / Location on Site</label>
                    <input value={modalForm.purpose || ""} onChange={e => setModalForm({ ...modalForm, purpose: e.target.value })}
                      placeholder="e.g. Foundation pour, Block B roof slab"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Notes</label>
                    <input value={modalForm.notes || ""} onChange={e => setModalForm({ ...modalForm, notes: e.target.value })}
                      placeholder="Any additional notes"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/40" />
                  </div>
                  {modalForm.quantityUsed > 0 && (
                    <div className="bg-orange-50 rounded-lg px-4 py-2 text-sm text-orange-700">
                      Stock after this: <strong>{Math.max(0, (selected?.stockQuantity || 0) - parseFloat(modalForm.quantityUsed || 0)).toLocaleString()} {selected?.unit}</strong>
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

            {/* Delete Modal */}
            {modal === "delete" && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-lg text-red-600">Delete Material</h2>
                  <button onClick={closeModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                </div>
                <p className="text-sm text-gray-600">
                  Are you sure you want to delete <strong>{selected?.itemName}</strong>? This cannot be undone.
                  All usage history for this material will also be removed.
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
