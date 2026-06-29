"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/hooks/use-toast";
import { AuditTrail } from "@/components/audit-trail";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function VendorsPage() {
  const { data: session } = useSession();
  const { data: vendors, mutate, isLoading } = useSWR("/api/vendors", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ category: "general" });
  const [errors, setErrors] = useState<Record<string,string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const canManage = ["admin","ceo","manager"].includes(session?.user?.role || "");
  const canDeactivate = ["admin","ceo"].includes(session?.user?.role || "");
  const filtered = (Array.isArray(vendors) ? vendors : []).filter((v: any) =>
    v.name?.toLowerCase().includes(search.toLowerCase()) || v.category?.toLowerCase().includes(search.toLowerCase())
  );

  function validate() {
    const e: Record<string,string> = {};
    if (!form.name?.trim()) e.name = "Vendor name is required.";
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email address.";
    if (form.phone && form.phone.length < 7) e.phone = "Enter a valid phone number.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/vendors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const e = await res.json(); setErrors({ name: e.error || "Failed to save vendor" }); return; }
      toast({ title: "Vendor added", description: `${form.name} has been added successfully.` });
      mutate(); setShowForm(false); setForm({ category: "general" }); setErrors({});
    } finally { setLoading(false); }
  }

  async function handleDeactivate(id: string, name: string) {
    const res = await fetch("/api/vendors/" + id, { method: "DELETE" });
    if (!res.ok) { toast({ title: "Error", description: "Could not deactivate vendor.", variant: "destructive" }); return; }
    toast({ title: "Vendor deactivated", description: `${name} has been deactivated.` });
    mutate();
  }

  function field(key: string, placeholder: string, type="text", extra?: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <div className="flex flex-col gap-1">
        <input type={type} value={form[key]||""} onChange={e=>{ setForm({...form,[key]:e.target.value}); if(errors[key]) setErrors({...errors,[key]:""}); }}
          placeholder={placeholder} className={"border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 " + (errors[key]?"border-red-400 bg-red-50":"border-gray-200")} {...extra} />
        {errors[key] && <p className="text-xs text-red-500">{errors[key]}</p>}
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div><h1 className="text-2xl font-bold text-gray-900">Vendors</h1><p className="text-sm text-gray-500">{filtered.length} vendors</p></div>
        {canManage && <button onClick={() => { setShowForm(!showForm); setErrors({}); setForm({ category:"general" }); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ New Vendor</button>}
      </div>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search vendors..." className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold text-gray-900">Add Vendor</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2 flex flex-col gap-1">
              <input required value={form.name||""} onChange={e=>{ setForm({...form,name:e.target.value}); if(errors.name) setErrors({...errors,name:""}); }}
                placeholder="Vendor / Company Name *" className={"w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 " + (errors.name?"border-red-400 bg-red-50":"border-gray-200")} />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            {field("contactPerson","Contact Person")}
            {field("phone","Phone Number","tel")}
            <div className="flex flex-col gap-1">
              {field("email","Email Address","email")}
            </div>
            <select value={form.category||"general"} onChange={e=>setForm({...form,category:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {["bricks","cement","steel","tiles","electrical","plumbing","paint","hardware","aggregate","general"].map(c=><option key={c} value={c}>{c}</option>)}
            </select>
            <div className="sm:col-span-2"><textarea value={form.address||""} onChange={e=>setForm({...form,address:e.target.value})} placeholder="Address" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
            {field("taxId","Tax ID / NTN")}
            {field("bankAccount","Bank Account (for payments)")}
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Saving…":"Add Vendor"}</button>
            <button type="button" onClick={()=>{ setShowForm(false); setErrors({}); }} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <CardGridSkeleton />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Building2 className="w-10 h-10" />} title="No vendors found" hint="Vendors are your suppliers and sub-contractors. Add a vendor to link them to materials and payments." />
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map((vendor: any) => (
          <div key={vendor.id} className="bg-white border border-gray-200 rounded-xl p-5 space-y-2 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{vendor.name}</h3>
                {vendor.isActive === false && <span className="text-xs text-red-500">Inactive</span>}
              </div>
              {vendor.category && <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full capitalize">{vendor.category}</span>}
            </div>
            {vendor.contactPerson && <p className="text-sm text-gray-600">&#x1F464; {vendor.contactPerson}</p>}
            {vendor.phone && <p className="text-sm text-gray-600">&#x1F4DE; {vendor.phone}</p>}
            {vendor.email && <p className="text-sm text-gray-600 truncate">&#x2709;&#xFE0F; {vendor.email}</p>}
            {vendor.address && <p className="text-xs text-gray-500 truncate">&#x1F4CD; {vendor.address}</p>}
            <AuditTrail entity="Vendor" entityId={vendor.id} createdAt={vendor.createdAt} />
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <p className="text-xs text-gray-400">{vendor._count?.materials || 0} materials · {vendor._count?.ledgerEntries || 0} transactions</p>
              {canDeactivate && vendor.isActive !== false && (
                <ConfirmDialog title="Deactivate Vendor?" message={`Deactivate ${vendor.name}? They will no longer appear in active vendor lists.`} confirmLabel="Deactivate" onConfirm={() => handleDeactivate(vendor.id, vendor.name)}>
                  {open => <button onClick={open} className="text-xs text-red-400 hover:text-red-600">Deactivate</button>}
                </ConfirmDialog>
              )}
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
