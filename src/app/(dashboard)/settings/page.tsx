"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Settings, ShieldAlert, CheckCircle, Save } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function SettingsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: settings, mutate, isLoading } = useSWR("/api/settings", fetcher);

  const [form, setForm] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAdmin = ["admin", "ceo"].includes(session?.user?.role || "");

  useEffect(() => {
    if (settings) {
      setForm({
        companyName: settings.companyName || "",
        address: settings.address || "",
        phone: settings.phone || "",
        email: settings.email || "",
        currency: settings.currency || "PKR",
        taxPercent: settings.taxPercent ?? 16,
        retentionPercent: settings.retentionPercent ?? 10,
        whtPercent: settings.whtPercent ?? 7.5,
        fiscalYearStart: settings.fiscalYearStart ? new Date(settings.fiscalYearStart).toISOString().slice(0, 10) : "",
      });
    }
  }, [settings]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) {
      toast({ title: "Access denied", description: "Only admins and CEOs can edit settings.", variant: "destructive" });
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        setError(err.error || "Failed to save settings");
        toast({ title: "Error", description: err.error || "Failed to save settings", variant: "destructive" });
        return;
      }
      toast({ title: "Settings saved", description: "Company settings have been updated successfully." });
      mutate();
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="p-6"><TableSkeleton /></div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="w-6 h-6 text-blue-600 animate-spin-slow" />
          Settings
        </h1>
        <p className="text-sm text-gray-500">Configure company metadata, taxation slabs, and financial controls.</p>
      </div>

      {!isAdmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-amber-800 text-sm">
          <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600" />
          <div>
            <p className="font-semibold">View-Only Mode</p>
            <p>Only administrators and CEOs can modify company settings. Contact your system administrator to make changes.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
        {/* Company Profile Section */}
        <div className="p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Company Profile</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Company Name *</label>
              <input
                required
                disabled={!isAdmin}
                value={form.companyName || ""}
                onChange={e => setForm({ ...form, companyName: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Contact Email</label>
              <input
                type="email"
                disabled={!isAdmin}
                value={form.email || ""}
                onChange={e => setForm({ ...form, email: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Contact Phone</label>
              <input
                disabled={!isAdmin}
                value={form.phone || ""}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Head Office Address</label>
              <input
                disabled={!isAdmin}
                value={form.address || ""}
                onChange={e => setForm({ ...form, address: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Financial & Tax Defaults */}
        <div className="p-6 space-y-4">
          <h2 className="text-base font-bold text-gray-900">Financial & Taxation Defaults</h2>
          <p className="text-xs text-gray-400">These default values populate when raising client billing invoices.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Currency Code</label>
              <input
                disabled={!isAdmin}
                value={form.currency || "PKR"}
                onChange={e => setForm({ ...form, currency: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50 font-bold text-blue-600"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Sales Tax Percent (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                disabled={!isAdmin}
                value={form.taxPercent ?? 16}
                onChange={e => setForm({ ...form, taxPercent: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Retention Deduction (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                disabled={!isAdmin}
                value={form.retentionPercent ?? 10}
                onChange={e => setForm({ ...form, retentionPercent: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Withholding Tax (WHT) (%)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                disabled={!isAdmin}
                value={form.whtPercent ?? 7.5}
                onChange={e => setForm({ ...form, whtPercent: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase block mb-1">Fiscal Year Start Date</label>
              <input
                type="date"
                disabled={!isAdmin}
                value={form.fiscalYearStart || ""}
                onChange={e => setForm({ ...form, fiscalYearStart: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50"
              />
            </div>
          </div>
        </div>

        {/* Submit Actions */}
        {isAdmin && (
          <div className="p-6 bg-gray-50 flex justify-end gap-3">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold disabled:opacity-50 hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving Changes..." : "Save Settings"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
