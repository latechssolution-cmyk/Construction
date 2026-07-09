"use client";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Wallet } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const FOR_MONTH_RE = /\[FOR:(\d{4}-\d{2})\]/;

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export function SalaryHistory() {
  const [employeeId, setEmployeeId] = useState("");
  const [month, setMonth] = useState(currentMonth());
  const [showAllMonths, setShowAllMonths] = useState(false);

  const { data: employeesRaw } = useSWR("/api/employees?limit=500", fetcher);
  const employees: any[] = employeesRaw?.data ? employeesRaw.data : (Array.isArray(employeesRaw) ? employeesRaw : []);

  const query = new URLSearchParams({ category: "salary", limit: "500" });
  if (employeeId) query.set("employeeId", employeeId);
  const { data: ledgerRaw, isLoading } = useSWR(`/api/ledger?${query.toString()}`, fetcher);

  const rows = useMemo(() => {
    const entries: any[] = ledgerRaw?.data ? ledgerRaw.data : (Array.isArray(ledgerRaw) ? ledgerRaw : []);
    return entries
      .map((e: any) => {
        const match = e.description?.match(FOR_MONTH_RE);
        return { ...e, forMonth: match ? match[1] : null };
      })
      .filter((e: any) => showAllMonths || !month || e.forMonth === month)
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [ledgerRaw, month, showAllMonths]);

  const totalPaid = rows.reduce((s: number, e: any) => s + (e.amount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={employeeId}
          onChange={(e) => setEmployeeId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">All employees</option>
          {employees.map((e: any) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <input
            type="month"
            value={month}
            disabled={showAllMonths}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:bg-gray-50 disabled:text-gray-400"
          />
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            <input type="checkbox" checked={showAllMonths} onChange={(e) => setShowAllMonths(e.target.checked)} />
            All months
          </label>
        </div>
        <div className="ml-auto text-sm text-gray-500">
          {rows.length} record{rows.length !== 1 ? "s" : ""} · <span className="font-semibold text-gray-800">PKR {totalPaid.toLocaleString()}</span> paid
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Wallet className="w-10 h-10" />} title="No salary records" hint="Salary payments recorded from the Employees tab will appear here, organized by month." />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Employee", "For Month", "Amount", "Payment Date", "Bank Account", "Reference"].map((h) => (
                    <th key={h} className="text-left py-3 px-4 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((e: any) => (
                  <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">{e.employee?.name || e.partyName || "—"}</td>
                    <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{e.forMonth || "—"}</td>
                    <td className="py-3 px-4 font-semibold text-gray-900 whitespace-nowrap">PKR {(e.amount || 0).toLocaleString()}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                    <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{e.bankAccount?.name || "—"}</td>
                    <td className="py-3 px-4 text-gray-400 whitespace-nowrap">{e.referenceNumber || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {rows.map((e: any) => (
              <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{e.employee?.name || e.partyName || "—"}</p>
                    <p className="text-xs text-gray-500">{e.forMonth ? `For ${e.forMonth}` : "—"}</p>
                  </div>
                  <span className="text-sm font-bold text-gray-900 shrink-0">PKR {(e.amount || 0).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                  <div><span className="text-gray-400">Paid: </span><span className="text-gray-700">{new Date(e.date).toLocaleDateString()}</span></div>
                  <div><span className="text-gray-400">Account: </span><span className="text-gray-700">{e.bankAccount?.name || "—"}</span></div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
