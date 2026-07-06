"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Building2, Mail, Phone, MapPin, User, Pencil, Trash2, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ClientsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: clients, mutate, isLoading } = useSWR("/api/clients", fetcher);

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
  const [editingClient, setEditingClient] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editLoading, setEditLoading] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canManage = ["admin", "ceo", "manager"].includes(session?.user?.role || "");
  const canDeactivate = ["admin", "ceo"].includes(session?.user?.role || "");

  const filtered = (Array.isArray(clients) ? clients : []).filter((c: any) =>
    c.name?.toLowerCase().includes(search.toLowerCase()) || c.email?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to create client", variant: "destructive" });
        return;
      }
      toast({ title: "Client created", description: "The client has been added successfully." });
      mutate();
      setShowForm(false);
      setForm({});
    } finally {
      setLoading(false);
    }
  }

  function startEdit(c: any) {
    setEditingClient(c);
    setEditForm({
      name: c.name,
      email: c.email || "",
      phone: c.phone || "",
      contactPerson: c.contactPerson || "",
      taxId: c.taxId || "",
      address: c.address || "",
      notes: c.notes || "",
    });
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEditLoading(true);
    try {
      const res = await fetch(`/api/clients/${editingClient.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Failed to update client", variant: "destructive" });
        return;
      }
      toast({ title: "Client updated", description: "Client details have been saved." });
      mutate();
      setEditingClient(null);
      setEditForm({});
    } finally {
      setEditLoading(false);
    }
  }

  async function toggleActive(client: any) {
    const deactivating = client.isActive !== false;
    if (deactivating) {
      const res = await fetch(`/api/clients/${client.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Error", description: err.error || "Cannot deactivate client", variant: "destructive" });
        return;
      }
      toast({ title: "Client deactivated", description: `${client.name} is now inactive.` });
    } else {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: true }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: err.error || "Cannot reactivate client", variant: "destructive" });
        return;
      }
      toast({ title: "Client reactivated", description: `${client.name} is now active.` });
    }
    mutate();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-sm text-gray-500">{filtered.length} clients</p>
        </div>
        {canManage && (
          <button
            onClick={() => { setShowForm(!showForm); setEditingClient(null); }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0"
          >
            {showForm ? "Cancel" : "+ New Client"}
          </button>
        )}
      </div>

      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search clients..."
        className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />

      {/* New Client Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Add Client</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <input
                required
                value={form.name || ""}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Company/Client Name *"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <input
              value={form.email || ""}
              onChange={e => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              value={form.phone || ""}
              onChange={e => setForm({ ...form, phone: e.target.value })}
              placeholder="Phone"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              value={form.contactPerson || ""}
              onChange={e => setForm({ ...form, contactPerson: e.target.value })}
              placeholder="Contact Person"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              value={form.taxId || ""}
              onChange={e => setForm({ ...form, taxId: e.target.value })}
              placeholder="Tax ID / NTN"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="sm:col-span-2">
              <textarea
                value={form.address || ""}
                onChange={e => setForm({ ...form, address: e.target.value })}
                placeholder="Address"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="sm:col-span-2">
              <textarea
                value={form.notes || ""}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Notes"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading ? "Saving..." : "Add Client"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* Edit Client Modal/Form */}
      {editingClient && (
        <form onSubmit={handleEditSubmit} className="bg-blue-50/50 border border-blue-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-blue-900">Edit Client: {editingClient.name}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <input
                required
                value={editForm.name || ""}
                onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                placeholder="Company/Client Name *"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <input
              value={editForm.email || ""}
              onChange={e => setEditForm({ ...editForm, email: e.target.value })}
              placeholder="Email"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              value={editForm.phone || ""}
              onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
              placeholder="Phone"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              value={editForm.contactPerson || ""}
              onChange={e => setEditForm({ ...editForm, contactPerson: e.target.value })}
              placeholder="Contact Person"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <input
              value={editForm.taxId || ""}
              onChange={e => setEditForm({ ...editForm, taxId: e.target.value })}
              placeholder="Tax ID / NTN"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
            <div className="sm:col-span-2">
              <textarea
                value={editForm.address || ""}
                onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                placeholder="Address"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
            <div className="sm:col-span-2">
              <textarea
                value={editForm.notes || ""}
                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Notes"
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={editLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">{editLoading ? "Saving..." : "Save Changes"}</button>
            <button type="button" onClick={() => { setEditingClient(null); setEditForm({}); }} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <CardGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="w-10 h-10" />} title="No clients yet" hint="Clients represent the companies or individuals you work for. Add your first client to get started." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((client: any) => (
            <div key={client.id} className={`bg-white border rounded-xl p-5 space-y-3 flex flex-col justify-between hover:shadow-md transition-shadow ${client.isActive === false ? "opacity-60 border-gray-100 bg-gray-50/50" : "border-gray-200"}`}>
              <div className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{client.name}</h3>
                    {client.contactPerson && (
                      <span className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
                        <User className="w-3 h-3" />
                        {client.contactPerson}
                      </span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${client.isActive === false ? "bg-gray-100 text-gray-500" : "bg-green-100 text-green-700"}`}>
                    {client.isActive === false ? "Inactive" : "Active"}
                  </span>
                </div>
                {client.email && <span className="flex items-center gap-1.5 text-sm text-gray-600 truncate"><Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" />{client.email}</span>}
                {client.phone && <span className="flex items-center gap-1.5 text-sm text-gray-600 truncate"><Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" />{client.phone}</span>}
                {client.address && <span className="flex items-center gap-1.5 text-xs text-gray-500 truncate"><MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />{client.address}</span>}
              </div>

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">{client._count?.projects || 0} projects · {client._count?.invoices || 0} invoices</p>
                <div className="flex items-center gap-2">
                  {canManage && (
                    <button
                      onClick={() => startEdit(client)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Edit Client"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(client.isActive === false ? canManage : canDeactivate) && (
                    <button
                      onClick={() => toggleActive(client)}
                      className={`text-xs px-2 py-1 rounded border font-medium ${
                        client.isActive === false
                          ? "border-green-200 text-green-700 bg-green-50/50 hover:bg-green-50"
                          : "border-red-100 text-red-600 bg-red-50/50 hover:bg-red-50"
                      }`}
                    >
                      {client.isActive === false ? "Activate" : "Deactivate"}
                    </button>
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
