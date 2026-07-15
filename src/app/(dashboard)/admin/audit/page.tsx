"use client";
import useSWR from "swr";
import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { ScrollText, Lock, Search, Activity, CalendarDays, Database, ChevronLeft, ChevronRight, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const ACTION_BADGE: Record<string, string> = {
  CREATE: "bg-green-100 text-green-700",
  UPDATE: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
};

// "ProjectPhase" → "Project Phase", "LedgerEntry" → "Ledger Entry"
const moduleLabel = (m: string) => (m || "").replace(/([a-z])([A-Z])/g, "$1 $2");

export default function AuditLogPage() {
  const { data: session } = useSession();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [q]);

  const params = new URLSearchParams();
  if (debouncedQ) params.set("q", debouncedQ);
  if (moduleFilter) params.set("entity", moduleFilter);
  if (actionFilter) params.set("action", actionFilter);
  if (userFilter) params.set("userId", userFilter);
  if (fromDate) params.set("from", fromDate);
  if (toDate) params.set("to", toDate);
  params.set("page", String(page));

  const isAdmin = ["admin", "ceo"].includes(session?.user?.role || "");
  const { data, isLoading } = useSWR(isAdmin ? `/api/audit?${params.toString()}` : null, fetcher, { keepPreviousData: true });
  const { data: users } = useSWR(isAdmin ? "/api/users" : null, fetcher);

  if (session && !isAdmin) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-medium text-gray-700">Access Restricted</p>
        <p className="text-sm mt-1">Only administrators and the CEO can view the audit log.</p>
      </div>
    );
  }

  const logs: any[] = data?.logs || [];
  const stats = data?.stats || {};
  const modules: string[] = data?.modules || [];
  const hasFilters = !!(debouncedQ || moduleFilter || actionFilter || userFilter || fromDate || toDate);

  function clearFilters() {
    setQ(""); setDebouncedQ(""); setModuleFilter(""); setActionFilter(""); setUserFilter("");
    setFromDate(""); setToDate(""); setPage(1);
  }

  const setFilter = (setter: (v: string) => void) => (v: string) => { setter(v); setPage(1); };

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Audit Log"
        subtitle={data ? `${(data.total ?? 0).toLocaleString()} event${data.total !== 1 ? "s" : ""}${hasFilters ? " (filtered)" : ""}` : undefined}
      />

      {!data && isLoading ? <StatsSkeleton count={3} /> : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Events Today" value={(stats.today ?? 0).toLocaleString()} tone="blue" icon={<Activity className="w-4 h-4" />} />
          <StatCard label="Last 7 Days" value={(stats.week ?? 0).toLocaleString()} tone="green" icon={<CalendarDays className="w-4 h-4" />} />
          <StatCard label="Total Recorded" value={(stats.total ?? 0).toLocaleString()} tone="gray" icon={<Database className="w-4 h-4" />} />
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center flex-wrap">
        <div className="relative w-full lg:w-72">
          <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search details (e.g. invoice number, name)…"
            className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          />
        </div>
        <select value={moduleFilter} onChange={e => setFilter(setModuleFilter)(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Modules</option>
          {modules.map(m => <option key={m} value={m}>{moduleLabel(m)}</option>)}
        </select>
        <select value={actionFilter} onChange={e => setFilter(setActionFilter)(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Actions</option>
          <option value="CREATE">Created</option>
          <option value="UPDATE">Updated</option>
          <option value="DELETE">Deleted</option>
        </select>
        <select value={userFilter} onChange={e => setFilter(setUserFilter)(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40 max-w-48">
          <option value="">All Users</option>
          {(Array.isArray(users) ? users : []).map((u: any) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <input type="date" value={fromDate} onChange={e => setFilter(setFromDate)(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
          <span className="text-xs text-gray-400">to</span>
          <input type="date" value={toDate} onChange={e => setFilter(setToDate)(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
        </div>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors">
            <X className="w-3 h-3" /> Clear filters
          </button>
        )}
      </div>

      {isLoading && !data ? (
        <TableSkeleton />
      ) : logs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState
            icon={<ScrollText className="w-10 h-10" />}
            title={hasFilters ? "No events match your filters" : "No audit events yet"}
            hint={hasFilters ? "Try widening the date range or clearing filters." : "Every create, update, and delete across the system is recorded here automatically."}
          />
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  {["Time", "User", "Action", "Module", "Details", "IP"].map(h => (
                    <th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any) => (
                  <tr key={log.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-gray-500 whitespace-nowrap">
                      <div>{new Date(log.createdAt).toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })}</div>
                      <div className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                          {log.user?.name?.[0] || "S"}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">{log.user?.name || "System"}</p>
                          {log.user?.role && <p className="text-[10px] text-gray-400 capitalize">{log.user.role}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_BADGE[log.action] || "bg-gray-100 text-gray-700"}`}>
                        {log.action?.charAt(0) + log.action?.slice(1).toLowerCase()}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-700 whitespace-nowrap">{moduleLabel(log.module)}</td>
                    <td className="py-3 px-3 text-gray-600 max-w-md"><span className="line-clamp-2">{log.details || "—"}</span></td>
                    <td className="py-3 px-3 text-gray-400 font-mono text-xs whitespace-nowrap">{log.ipAddress || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {logs.map((log: any) => (
              <div key={log.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">
                      {log.user?.name?.[0] || "S"}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{log.user?.name || "System"}</p>
                      <p className="text-[10px] text-gray-400">{new Date(log.createdAt).toLocaleString("en-PK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${ACTION_BADGE[log.action] || "bg-gray-100 text-gray-700"}`}>
                    {log.action?.charAt(0) + log.action?.slice(1).toLowerCase()}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-2"><span className="font-medium text-gray-700">{moduleLabel(log.module)}</span>{log.details ? ` — ${log.details}` : ""}</p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {data?.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Page {data.page} of {data.totalPages} · {(data.total ?? 0).toLocaleString()} events
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Prev
                </button>
                <button
                  onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                  disabled={page >= data.totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
