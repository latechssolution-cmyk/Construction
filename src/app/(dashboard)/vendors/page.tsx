"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { AuditTrail } from "@/components/audit-trail";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, Pencil, X, Search } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function VendorsPage() {
  const { data: session } = useSession();
  const { data: vendors, mutate, isLoading } = useSWR("/api/vendors", fetcher);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ category: "general" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("q");
      if (q) setSearch(q);
    }
  }, []);

  // Edit states
  const [editingVendor, setEditingVendor] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editErrors, setEditErrors] = useState<Record<string, string>>({});
  const [editLoading, setEditLoading] = useState(false);

  const canManage = ["admin", "ceo", "manager"].includes(session?.user?.role || "");
  const canDeactivate = ["admin", "ceo"].includes(session?.user?.role || "");

  const filtered = (Array.isArray(vendors) ? vendors : []).filter((v: any) =>
    v.name?.toLowerCase().includes(search.toLowerCase()) || v.category?.toLowerCase().includes(search.toLowerCase())
  );

  function validate(data: any, isEdit = false) {
    const e: Record<string, string> = {};
    if (!data.name?.trim()) e.name = "Vendor name is required.";
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) e.email = "Enter a valid email address.";
    if (data.phone && data.phone.length < 7) e.phone = "Enter a valid phone number.";
    if (isEdit) {
      setEditErrors(e);
    } else {
      setErrors(e);
    }
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(form, false)) return;
    setLoading(true);
    try {
      const res = await fetch("/api/vendors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const e = await res.json();
        setErrors({ name: e.error || "Failed to save vendor" });
        return;
      }
      toast({ title: "Vendor added", description: `${form.name} has been added successfully.` });
      mutate();
      setShowForm(false);
      setForm({ category: "general" });
      setErrors({});
    } finally {
      setLoading(false);
    }
  }

  function startEdit(v: any) {
    setEditingVendor(v);
    setEditErrors({});
    setEditForm({
      name: v.name,
      contactPerson: v.contactPerson || "",
      phone: v.phone || "",
      email: v.email || "",
      category: v.category || "general",
      address: v.address || "",
      taxId: v.taxId || "",
      bankAccount: v.bankAccount || "",
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate(editForm, true)) return;
    setEditLoading(true);
    try {
      const res = await fetch(`/api/vendors/${editingVendor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const e = await res.json();
        setEditErrors({ name: e.error || "Failed to update vendor" });
        return;
      }
      toast({ title: "Vendor updated", description: `${editForm.name} details have been updated.` });
      mutate();
      setEditingVendor(null);
      setEditForm({});
      setEditErrors({});
    } finally {
      setEditLoading(false);
    }
  }

  async function handleDeactivate(id: string, name: string) {
    const res = await fetch("/api/vendors/" + id, { method: "DELETE" });
    if (!res.ok) {
      toast({ title: "Error", description: "Could not deactivate vendor.", variant: "destructive" });
      return;
    }
    toast({ title: "Vendor deactivated", description: `${name} has been deactivated.` });
    mutate();
  }

  async function handleActivate(vendor: any) {
    const res = await fetch(`/api/vendors/${vendor.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: true }),
    });
    if (!res.ok) {
      toast({ title: "Error", description: "Could not activate vendor.", variant: "destructive" });
      return;
    }
    toast({ title: "Vendor activated", description: `${vendor.name} is now active.` });
    mutate();
  }

  function field(key: string, placeholder: string, type = "text", extra?: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type={type}
          value={form[key] || ""}
          onChange={e => {
            setForm({ ...form, [key]: e.target.value });
            if (errors[key]) setErrors({ ...errors, [key]: "" });
          }}
          placeholder={placeholder}
          className={"border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 " + (errors[key] ? "border-red-400 bg-red-50" : "border-gray-200")}
          {...extra}
        />
        {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
      </div>
    );
  }

  function editField(key: string, placeholder: string, type = "text", extra?: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type={type}
          value={editForm[key] || ""}
          onChange={e => {
            setEditForm({ ...editForm, [key]: e.target.value });
            if (editErrors[key]) setEditErrors({ ...editErrors, [key]: "" });
          }}
          placeholder={placeholder}
          className={"border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 " + (editErrors[key] ? "border-red-400 bg-red-50" : "border-gray-300")}
          {...extra}
        />
        {editErrors[key] && <p className="text-xs text-red-500">{editErrors[key]}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
          <p className="text-sm text-gray-500">{filtered.length} vendors</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowForm(!showForm); setEditingVendor(null); setErrors({}); setForm({ category: "general" }); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 shadow-sm"
          >
            {showForm ? "Cancel" : "+ New Vendor"}
          </button>
        )}
      </div>

      <div className="relative w-full sm:w-80">
        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search vendors..."
          className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>

      {/* Add Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Add Vendor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <input
                required
                value={form.name || ""}
                onChange={e => { setForm({ ...form, name: e.target.value }); if (errors.name) setErrors({ ...errors, name: "" }); }}
                placeholder="Vendor / Company Name *"
                className={"w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 " + (errors.name ? "border-red-400 bg-red-50" : "border-gray-200")}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            {field("contactPerson", "Contact Person")}
            {field("phone", "Phone Number", "tel")}
            <div className="flex flex-col gap-1">
              {field("email", "Email Address", "email")}
            </div>
            <select
              value={form.category || "general"}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {["bricks", "cement", "steel", "tiles", "electrical", "plumbing", "paint", "hardware", "aggregate", "general"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="sm:col-span-2">
              <textarea
                value={form.address || ""}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Address"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            {field("taxId", "Tax ID / NTN")}
            {field("bankAccount", "Bank Account (for payments)")}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading ? "Saving…" : "Add Vendor"}</button>
            <button type="button" onClick={() => { setShowForm(false); setErrors({}); }} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Edit Form */}
      {editingVendor && (
        <form onSubmit={handleEditSubmit} className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-blue-900">Edit Vendor: {editingVendor.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <input
                required
                value={editForm.name || ""}
                onChange={e => { setEditForm({ ...editForm, name: e.target.value }); if (editErrors.name) setEditErrors({ ...editErrors, name: "" }); }}
                placeholder="Vendor / Company Name *"
                className={"w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 " + (editErrors.name ? "border-red-400 bg-red-50" : "border-gray-300")}
              />
              {editErrors.name && <p className="text-xs text-red-500">{editErrors.name}</p>}
            </div>
            {editField("contactPerson", "Contact Person")}
            {editField("phone", "Phone Number", "tel")}
            <div className="flex flex-col gap-1">
              {editField("email", "Email Address", "email")}
            </div>
            <select
              value={editForm.category || "general"}
              onChange={e => setEditForm({ ...editForm, category: e.target.value })}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              {["bricks", "cement", "steel", "tiles", "electrical", "plumbing", "paint", "hardware", "aggregate", "general"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <div className="sm:col-span-2">
              <textarea
                value={editForm.address || ""}
                onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Address"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            {editField("taxId", "Tax ID / NTN")}
            {editField("bankAccount", "Bank Account (for payments)")}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={editLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">{editLoading ? "Saving…" : "Save Changes"}</button>
            <button type="button" onClick={() => { setEditingVendor(null); setEditErrors({}); }} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <CardGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="w-10 h-10" />} title="No vendors found" hint="Vendors are your suppliers and sub-contractors. Add a vendor to link them to materials and payments." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((vendor: any) => (
            <div key={vendor.id} className={`bg-white border rounded-xl p-5 shadow-sm space-y-2 flex flex-col justify-between hover:shadow-md hover:border-blue-200 transition-all ${vendor.isActive === false ? "opacity-60 border-gray-100 bg-gray-50/50" : "border-gray-200"}`}>
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{vendor.name}</h3>
                    {vendor.isActive === false && <span className="text-xs text-red-600 font-semibold">Inactive</span>}
                  </div>
                  {vendor.category && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize shrink-0">{vendor.category}</span>}
                </div>
                {vendor.contactPerson && <p className="text-sm text-gray-600 truncate">&#x1F464; {vendor.contactPerson}</p>}
                {vendor.phone && <p className="text-sm text-gray-600 truncate">&#x1F4DE; {vendor.phone}</p>}
                {vendor.email && <p className="text-sm text-gray-600 truncate">&#x2709;&#xFE0F; {vendor.email}</p>}
                {vendor.address && <p className="text-xs text-gray-500 truncate">&#x1F4CD; {vendor.address}</p>}
                <AuditTrail entity="Vendor" entityId={vendor.id} createdAt={vendor.createdAt} />
              </div>

              <div className="pt-2 mt-2 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">{vendor._count?.materials || 0} materials · {vendor._count?.ledgerEntries || 0} transactions</p>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <button
                      onClick={() => startEdit(vendor)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Vendor"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canDeactivate && (
                    vendor.isActive !== false ? (
                      <ConfirmDialog title="Deactivate Vendor?" message={`Deactivate ${vendor.name}? They will no longer appear in active vendor lists.`} confirmLabel="Deactivate" onConfirm={() => handleDeactivate(vendor.id, vendor.name)}>
                        {open => <button onClick={open} className="text-xs px-2 py-1 rounded border border-red-100 text-red-600 bg-red-50/50 hover:bg-red-50">Deactivate</button>}
                      </ConfirmDialog>
                    ) : (
                      <button onClick={() => handleActivate(vendor)} className="text-xs px-2 py-1 rounded border border-green-200 text-green-700 bg-green-50/50 hover:bg-green-50">Activate</button>
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
