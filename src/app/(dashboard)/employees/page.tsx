"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Users, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function EmployeesPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: employees, mutate, isLoading } = useSWR("/api/employees", fetcher);
  const { data: bankAccounts } = useSWR("/api/bank-accounts", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [salaryModal, setSalaryModal] = useState<any>(null);
  const [salaryForm, setSalaryForm] = useState<any>({});
  const [salaryLoading, setSalaryLoading] = useState(false);

  const canManage = ["admin", "ceo", "manager"].includes(session?.user?.role || "");
  const canPaySalary = ["admin", "ceo", "accountant"].includes(session?.user?.role || "");
  const filtered = (Array.isArray(employees) ? employees : []).filter((e: any) =>
    e.name?.toLowerCase().includes(search.toLowerCase()) || e.role?.toLowerCase().includes(search.toLowerCase()) || e.department?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/employees", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.error || "Failed to hire employee", variant: "destructive" }); return; }
      mutate();
      setShowForm(false);
      setForm({});
    } finally { setLoading(false); }
  }

  async function deactivate(id: string) {
    const res = await fetch(`/api/employees/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: false }) });
    if (!res.ok) { const e = await res.json().catch(() => ({})); toast({ title: "Error", description: e.error || "Failed to deactivate employee", variant: "destructive" }); return; }
    mutate();
  }

  function openSalaryModal(emp: any) {
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);
    setSalaryForm({ amount: emp.salary || "", date: today, month, bankAccountId: "" });
    setSalaryModal(emp);
  }

  async function handlePaySalary(ev: React.FormEvent) {
    ev.preventDefault();
    setSalaryLoading(true);
    try {
      const res = await fetch(`/api/employees/${salaryModal.id}/salary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(salaryForm),
      });
      if (!res.ok) {
        const e = await res.json();
        toast({ title: "Error", description: e.error || "Failed to pay salary", variant: "destructive" });
        return;
      }
      toast({ title: "Salary paid", description: `PKR ${Number(salaryForm.amount).toLocaleString()} paid to ${salaryModal.name}` });
      setSalaryModal(null);
      mutate();
    } finally {
      setSalaryLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Employees</h1>
          <p className="text-sm text-gray-500">{filtered.length} employee{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        {canManage && (
          <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">
            + Hire Employee
          </button>
        )}
      </div>

      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, role, department…" className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-80 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Hire Employee</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required value={form.role || ""} onChange={(e) => setForm({ ...form, role: e.target.value })} placeholder="Job Role/Title *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={form.department || ""} onChange={(e) => setForm({ ...form, department: e.target.value })} placeholder="Department" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={form.cnic || ""} onChange={(e) => setForm({ ...form, cnic: e.target.value })} placeholder="CNIC" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input type="number" value={form.salary || ""} onChange={(e) => setForm({ ...form, salary: e.target.value })} placeholder="Salary (PKR)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select value={form.salaryType || "monthly"} onChange={(e) => setForm({ ...form, salaryType: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="monthly">Monthly</option><option value="daily">Daily</option><option value="hourly">Hourly</option>
            </select>
            <input type="date" value={form.joiningDate || ""} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input value={form.bankAccount || ""} onChange={(e) => setForm({ ...form, bankAccount: e.target.value })} placeholder="Bank Account #" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <div className="sm:col-span-2"><textarea value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Address" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" /></div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading ? "Saving…" : "Add Employee"}</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Users className="w-10 h-10" />} title="No employees found" hint="Add your team members here to track attendance, assign tasks, and manage payroll." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Name", "Role", "Dept", "Phone", "Salary", "Type", "Joined", "Status", "Actions"].map((h) => <th key={h} className="text-left py-3 px-4 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp: any) => (
                  <tr key={emp.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{emp.name}</td>
                    <td className="py-3 px-4 text-gray-600">{emp.role}</td>
                    <td className="py-3 px-4 text-gray-500">{emp.department || "—"}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{emp.phone || "—"}</td>
                    <td className="py-3 px-4 font-medium whitespace-nowrap">PKR {(emp.salary || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-500 capitalize">{emp.salaryType}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : "—"}</td>
                    <td className="py-3 px-4"><span className={`text-xs px-2 py-0.5 rounded-full ${emp.isActive !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{emp.isActive !== false ? "Active" : "Inactive"}</span></td>
                    <td className="py-3 px-4">
                      {canManage && emp.isActive !== false && (
                        <div className="flex items-center gap-3">
                          {canPaySalary && <button onClick={() => openSalaryModal(emp)} className="text-xs text-blue-600 hover:underline font-medium">Pay Salary</button>}
                          <button onClick={() => deactivate(emp.id)} className="text-xs text-red-500 hover:underline">Deactivate</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((emp: any) => (
              <div key={emp.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.role}{emp.department ? ` · ${emp.department}` : ""}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${emp.isActive !== false ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{emp.isActive !== false ? "Active" : "Inactive"}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <div><span className="text-gray-400">Phone: </span><span className="text-gray-700">{emp.phone || "—"}</span></div>
                  <div><span className="text-gray-400">Joined: </span><span className="text-gray-700">{emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString() : "—"}</span></div>
                  <div><span className="text-gray-400">Salary: </span><span className="text-gray-700 font-medium">PKR {(emp.salary || 0).toLocaleString()}</span></div>
                  <div><span className="text-gray-400">Type: </span><span className="text-gray-700 capitalize">{emp.salaryType}</span></div>
                </div>
                {canManage && emp.isActive !== false && (
                  <div className="mt-3 pt-3 border-t border-gray-100 flex justify-end gap-4">
                    {canPaySalary && <button onClick={() => openSalaryModal(emp)} className="text-xs text-blue-600 hover:underline font-medium">Pay Salary</button>}
                    <button onClick={() => deactivate(emp.id)} className="text-xs text-red-500 hover:underline">Deactivate</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
      {/* Pay Salary Modal */}
      {salaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
              <div>
                <h2 className="font-semibold text-gray-900">Pay Salary</h2>
                <p className="text-xs text-gray-500 mt-0.5">{salaryModal.name} · {salaryModal.role}</p>
              </div>
              <button onClick={() => setSalaryModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handlePaySalary} className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Amount (PKR) *</label>
                <input
                  required type="number" min="1"
                  value={salaryForm.amount}
                  onChange={e => setSalaryForm({ ...salaryForm, amount: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  placeholder="e.g. 50000"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">For Month *</label>
                <input
                  required type="month"
                  value={salaryForm.month}
                  onChange={e => setSalaryForm({ ...salaryForm, month: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Payment Date *</label>
                <input
                  required type="date"
                  value={salaryForm.date}
                  onChange={e => setSalaryForm({ ...salaryForm, date: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Pay From Bank Account *</label>
                <select
                  required
                  value={salaryForm.bankAccountId}
                  onChange={e => setSalaryForm({ ...salaryForm, bankAccountId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                >
                  <option value="">Select account…</option>
                  {(Array.isArray(bankAccounts) ? bankAccounts : []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.name} — PKR {(b.balance || 0).toLocaleString()}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit" disabled={salaryLoading}
                  className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {salaryLoading ? "Processing…" : "Confirm Payment"}
                </button>
                <button
                  type="button" onClick={() => setSalaryModal(null)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
