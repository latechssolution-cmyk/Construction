"use client";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  CheckCircle2, Calendar, BarChart2, Landmark,
  FolderOpen, FolderKanban, Receipt, Users2, TrendingUp, TrendingDown,
  Wallet, ClipboardList, Boxes, Sparkles, AlertTriangle, Wrench,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, AreaChart, Area,
} from "recharts";
import { StatCard } from "@/components/ui/stat-card";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const RAG: Record<string, string> = { red: "bg-red-500", amber: "bg-yellow-400", green: "bg-green-500" };
const RAG_LABEL: Record<string, string> = { red: "At Risk", amber: "Watch", green: "On Track" };
const RAG_TEXT: Record<string, string> = { red: "text-red-600", amber: "text-yellow-600", green: "text-green-600" };
const PIE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

const pkr = (n: number) => `PKR ${Math.round(n || 0).toLocaleString()}`;
const compact = (n: number) => {
  const v = Math.abs(n || 0);
  if (v >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return `${Math.round(n || 0)}`;
};

function ProgressBar({ pct, color = "bg-blue-500" }: { pct: number; color?: string }) {
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5">
      <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }}></div>
    </div>
  );
}

function ChartCard({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm p-5 ${className}`}>
      <h2 className="font-semibold mb-4 text-gray-900">{title}</h2>
      {children}
    </div>
  );
}

function EmptyChart({ msg }: { msg: string }) {
  return <div className="h-[260px] flex items-center justify-center text-sm text-gray-400">{msg}</div>;
}

/* ------------------------------ ADMIN / CEO ------------------------------ */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">{children}</h2>;
}

function AdminDashboard({ data }: { data: any }) {
  const recentActivity = data?.recentActivity || [];
  const revenueTrend = data?.revenueTrend || [];
  const p = data?.projects || {};
  const f = data?.finances || {};
  const staff = data?.staff || {};
  const eq = data?.equipment || {};
  const assets = data?.assets || {};
  const activeProjects: any[] = data?.activeProjects || [];
  const hasTrend = revenueTrend.some((r: any) => (r.income || 0) > 0 || (r.expense || 0) > 0);
  const statusChart = (p.byStatusChart || []).filter((s: any) => s.count > 0);
  const noAndCost = (bucket: any) => `${bucket?.count || 0}`;

  return (
    <div className="space-y-8">
      {/* ── PROJECTS ── */}
      <section className="space-y-3">
        <SectionTitle>Projects</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard label="Total Projects" value={noAndCost(p.total)} sub={pkr(p.total?.cost || 0)} tone="blue" icon={<FolderOpen className="w-4 h-4" />} href="/projects" />
          <StatCard label="Ongoing" value={noAndCost(p.ongoing)} sub={pkr(p.ongoing?.cost || 0)} tone="green" icon={<FolderKanban className="w-4 h-4" />} href="/projects?status=ongoing" />
          <StatCard label="Physically Closed" value={noAndCost(p.physically_closed)} sub={pkr(p.physically_closed?.cost || 0)} tone="blue" icon={<CheckCircle2 className="w-4 h-4" />} href="/projects?status=physically_closed" />
          <StatCard label="Financially Closed" value={noAndCost(p.financially_closed)} sub={pkr(p.financially_closed?.cost || 0)} tone="green" icon={<CheckCircle2 className="w-4 h-4" />} href="/projects?status=financially_closed" />
          <StatCard label="Sick Projects" value={noAndCost(p.sick)} sub={pkr(p.sick?.cost || 0)} tone={p.sick?.count > 0 ? "red" : "gray"} urgent={p.sick?.count > 0} icon={<AlertTriangle className="w-4 h-4" />} href="/projects?status=sick" />
        </div>
        <ChartCard title="Projects by Status (count & CA value)">
          {statusChart.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={statusChart} margin={{ left: -10, right: 10, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} className="capitalize" />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={compact} />
                <Tooltip formatter={(v: number, n: string) => n === "CA Value" ? pkr(v) : v} />
                <Legend />
                <Bar yAxisId="left" dataKey="count" name="Projects" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={22} />
                <Bar yAxisId="right" dataKey="cost" name="CA Value" fill="#10b981" radius={[4, 4, 0, 0]} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="No projects yet." />}
        </ChartCard>
      </section>

      {/* ── FINANCES ── */}
      <section className="space-y-3">
        <SectionTitle>Finances</SectionTitle>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          <StatCard label="Total Contract Value" value={pkr(f.totalContractValue)} tone="blue" icon={<Landmark className="w-4 h-4" />} href="/projects" />
          <StatCard label="Total Revenue Earned" value={pkr(f.totalRevenue)} tone="green" icon={<TrendingUp className="w-4 h-4" />} href="/finance/ledger?type=income" />
          <StatCard label="Total Expenses" value={pkr(f.totalExpense)} tone="red" icon={<TrendingDown className="w-4 h-4" />} href="/finance/ledger?type=expense" />
          <StatCard label="Gross Profit" value={pkr(f.grossProfit)} tone={(f.grossProfit || 0) >= 0 ? "green" : "orange"} icon={<Wallet className="w-4 h-4" />} href="/finance/profit-sheets" />
          <StatCard label="Cash in Bank" value={pkr(f.cashInBank)} tone="blue" icon={<Landmark className="w-4 h-4" />} href="/finance/accounts" />
          <StatCard label="Accounts Receivable" value={pkr(f.accountsReceivable)} sub="Billed, unpaid" tone="orange" icon={<Receipt className="w-4 h-4" />} href="/billing?status=sent" />
          <StatCard label="Accounts Payable" value={pkr(f.accountsPayable)} sub="Open commitments" tone="purple" icon={<Receipt className="w-4 h-4" />} />
        </div>
        <ChartCard title="Revenue vs Expense (Last 6 Months)">
          {hasTrend ? (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={revenueTrend} margin={{ left: -10, right: 10, top: 5 }}>
                <defs>
                  <linearGradient id="inc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.4} /><stop offset="95%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#ef4444" stopOpacity={0.35} /><stop offset="95%" stopColor="#ef4444" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={compact} />
                <Tooltip formatter={(v: number) => pkr(v)} />
                <Legend />
                <Area type="monotone" dataKey="income" name="Income" stroke="#10b981" fill="url(#inc)" strokeWidth={2} />
                <Area type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" fill="url(#exp)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : <EmptyChart msg="No ledger activity yet — add income/expense entries to see the trend." />}
        </ChartCard>
      </section>

      {/* ── STAFF · EQUIPMENT · ASSETS ── */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <SectionTitle>Staff</SectionTitle>
          <div className="grid grid-cols-1 gap-3">
            <StatCard label="Total Employees" value={staff.totalEmployees || 0} tone="blue" icon={<Users2 className="w-4 h-4" />} href="/people?tab=employees" />
            <StatCard label="Active Employees" value={staff.activeEmployees || 0} tone="green" icon={<Users2 className="w-4 h-4" />} href="/people?tab=employees" />
            <StatCard label="Gross Salary (Active)" value={pkr(staff.grossSalary)} tone="purple" icon={<Wallet className="w-4 h-4" />} href="/people?tab=salary" />
          </div>
        </div>
        <div className="space-y-3">
          <SectionTitle>Equipment</SectionTitle>
          <div className="grid grid-cols-1 gap-3">
            <StatCard label="Total Equipment" value={eq.total || 0} sub={pkr(eq.totalCost || 0)} tone="blue" icon={<Wrench className="w-4 h-4" />} href="/equipment" />
            <StatCard label="Working" value={eq.working || 0} tone="green" icon={<Wrench className="w-4 h-4" />} href="/equipment" />
            <StatCard label="Idle" value={eq.idle || 0} tone={eq.idle > 0 ? "orange" : "gray"} icon={<Wrench className="w-4 h-4" />} href="/equipment" />
          </div>
        </div>
        <div className="space-y-3">
          <SectionTitle>Assets</SectionTitle>
          <div className="grid grid-cols-1 gap-3">
            <StatCard label="Total Assets" value={assets.total || 0} sub={`Value ${pkr(assets.totalValue || 0)}`} tone="blue" icon={<Boxes className="w-4 h-4" />} href="/assets" />
            <StatCard label="Current Book Value" value={pkr(assets.bookValue)} tone="green" icon={<TrendingDown className="w-4 h-4" />} href="/assets" />
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Idle / Maint." value={assets.idleOrMaintenance || 0} tone={assets.idleOrMaintenance > 0 ? "orange" : "gray"} href="/assets" />
              <StatCard label="Due Maint." value={assets.dueMaintenance || 0} tone={assets.dueMaintenance > 0 ? "red" : "green"} urgent={assets.dueMaintenance > 0} href="/assets" />
            </div>
          </div>
        </div>
      </section>

      {/* ── ACTIVE PROJECTS TABLE ── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <SectionTitle>Active Projects</SectionTitle>
          <Link href="/projects?status=ongoing" className="text-xs text-blue-600 hover:underline">View all</Link>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                <th className="text-left py-2.5 px-4 font-medium">Project Name</th>
                <th className="text-right py-2.5 px-4 font-medium">CA Value</th>
                <th className="text-right py-2.5 px-4 font-medium">Work Done</th>
                <th className="text-left py-2.5 px-4 font-medium w-40">Progress %</th>
                <th className="text-right py-2.5 px-4 font-medium">Payment Received</th>
              </tr></thead>
              <tbody>
                {activeProjects.map((row: any) => (
                  <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-3 px-4"><Link href={`/projects/${row.id}`} className="font-medium text-gray-900 hover:text-blue-600">{row.name}</Link></td>
                    <td className="py-3 px-4 text-right text-gray-800">{pkr(row.caValue)}</td>
                    <td className="py-3 px-4 text-right text-gray-800">{pkr(row.workDone)}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2"><ProgressBar pct={row.progress} color="bg-blue-500" /><span className="text-xs text-gray-500 w-9 text-right">{row.progress}%</span></div>
                    </td>
                    <td className="py-3 px-4 text-right font-medium text-green-700">{pkr(row.paymentReceived)}</td>
                  </tr>
                ))}
                {activeProjects.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-gray-400 text-sm">No active projects.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── RECENT ACTIVITY ── */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
        <h2 className="font-semibold mb-4 text-gray-900">Recent Activity</h2>
        <div className="space-y-2">
          {recentActivity.slice(0, 8).map((a: any, i: number) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-bold shrink-0">{a.user?.name?.[0] || "?"}</div>
              <div className="flex-1">
                <p className="text-sm text-gray-800"><span className="font-medium">{a.user?.name || "System"}</span> {a.action?.toLowerCase()} {a.module}</p>
                <p className="text-xs text-gray-400">{new Date(a.createdAt).toLocaleString()}</p>
              </div>
            </div>
          ))}
          {recentActivity.length === 0 && <p className="text-sm text-gray-400">No recent activity yet. Actions you take will appear here.</p>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ MANAGER ------------------------------ */
function ManagerDashboard({ data }: { data: any }) {
  const dueSoon = data?.dueSoonTasks || [];
  const milestones = data?.upcomingMilestones || [];
  const lowStock = data?.lowStockItems || [];
  const progress = (data?.projectProgress || []).map((p: any) => ({
    name: p.name?.length > 16 ? p.name.slice(0, 16) + "…" : p.name,
    Completion: p.completionPercent,
    Tasks: p.taskProgress,
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Projects" value={data?.myProjectsCount || 0} tone="blue" icon={<FolderOpen className="w-4 h-4" />} href="/projects" />
        <StatCard label="Active Projects" value={data?.activeProjectsCount || 0} tone="green" icon={<FolderKanban className="w-4 h-4" />} href="/projects?status=ongoing" />
        <StatCard label="Tasks Due in 7 Days" value={dueSoon.length} tone={dueSoon.length > 0 ? "orange" : "green"} sub={dueSoon.length > 0 ? "Action needed" : undefined} urgent={dueSoon.length > 0} icon={<ClipboardList className="w-4 h-4" />} href="/tasks" />
        <StatCard label="Low Stock Alerts" value={lowStock.length} tone={lowStock.length > 0 ? "red" : "green"} sub={lowStock.length > 0 ? "Reorder required" : undefined} urgent={lowStock.length > 0} icon={<Boxes className="w-4 h-4" />} href="/materials?lowStock=1" />
      </div>

      {/* Project progress chart — real data */}
      <ChartCard title="Project Progress (% Complete vs Task Completion)">
        {progress.length > 0 ? (
          <ResponsiveContainer width="100%" height={Math.max(220, progress.length * 46)}>
            <BarChart data={progress} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Legend />
              <Bar dataKey="Completion" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
              <Bar dataKey="Tasks" fill="#10b981" radius={[0, 4, 4, 0]} barSize={12} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart msg="No projects assigned yet." />}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Tasks Due in 7 Days">
          {dueSoon.length === 0 ? <div className="text-center py-6"><CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" /><p className="text-sm text-gray-400">No tasks due this week — great work!</p></div> : (
            <div className="space-y-2">
              {dueSoon.map((t: any) => (
                <Link key={t.id} href={t.projectId ? `/projects/${t.projectId}` : "/tasks"} className="flex items-center justify-between py-2 border-b border-gray-50 hover:bg-gray-50 -mx-1 px-1 rounded">
                  <div><p className="text-sm font-medium text-gray-900">{t.title}</p><p className="text-xs text-gray-400">{t.project?.name}</p></div>
                  <span className="text-xs text-orange-600 font-medium">{new Date(t.dueDate).toLocaleDateString()}</span>
                </Link>
              ))}
            </div>
          )}
        </ChartCard>
        <ChartCard title="Upcoming Milestones">
          {milestones.length === 0 ? <div className="text-center py-6"><Calendar className="w-6 h-6 text-gray-300 mx-auto mb-1" /><p className="text-sm text-gray-400">No milestones due in the next 30 days.</p></div> : (
            <div className="space-y-2">
              {milestones.map((m: any) => (
                <Link key={m.id} href={m.projectId ? `/projects/${m.projectId}` : "/projects"} className="flex items-center justify-between py-2 border-b border-gray-50 hover:bg-gray-50 -mx-1 px-1 rounded">
                  <div><p className="text-sm font-medium text-gray-900">{m.name}</p><p className="text-xs text-gray-400">{m.project?.name}</p></div>
                  <span className="text-xs text-blue-600 font-medium">{m.dueDate ? new Date(m.dueDate).toLocaleDateString() : "—"}</span>
                </Link>
              ))}
            </div>
          )}
        </ChartCard>
      </div>

      {lowStock.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-red-700">Low Stock — Action Required</h2>
            <Link href="/materials" className="text-xs text-red-600 hover:underline">View Materials</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {lowStock.map((m: any) => (
              <Link key={m.id} href="/materials?lowStock=1" className="bg-white rounded-lg p-3 border border-red-100 hover:border-red-300 transition-colors">
                <p className="text-sm font-medium text-gray-900">{m.itemName}</p>
                <p className="text-xs text-gray-500">{m.project?.name}</p>
                <p className="text-xs text-red-600 font-medium mt-1">{m.stockQuantity} {m.unit} left (min: {m.minStockLevel})</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ ACCOUNTANT ------------------------------ */
function AccountantDashboard({ data }: { data: any }) {
  const monthlyTrend = (data?.monthlyTrend || []).map((m: any) => ({ name: m.label || m.month, Income: m.income || 0, Expense: m.expense || 0 }));
  const bankAccounts = data?.bankAccounts || [];
  const pendingInvoices = data?.pendingInvoices || [];
  const totalCash = bankAccounts.reduce((s: number, b: any) => s + (b.balance || 0), 0);
  const hasFlow = monthlyTrend.some((m: any) => m.Income > 0 || m.Expense > 0);

  return (
    <div className="space-y-6">
      <Link href="/finance/accounts" className="block bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white min-w-0 hover:from-blue-700 hover:to-blue-800 transition-colors">
        <p className="text-sm font-medium opacity-80 truncate">Total Cash Position</p>
        <p className="text-2xl sm:text-3xl lg:text-4xl font-bold mt-1 break-words" title={pkr(totalCash)}>{pkr(totalCash)}</p>
        <p className="text-xs opacity-70 mt-1">Across {bankAccounts.length} bank account{bankAccounts.length !== 1 ? "s" : ""}</p>
      </Link>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Month Income" value={pkr(data?.monthIncome || 0)} tone="green" icon={<TrendingUp className="w-4 h-4" />} href="/finance/ledger?type=income" />
        <StatCard label="Month Expense" value={pkr(data?.monthExpense || 0)} tone="red" icon={<TrendingDown className="w-4 h-4" />} href="/finance/ledger?type=expense" />
        <StatCard label="Total Income" value={pkr(data?.totalIncome || 0)} tone="green" icon={<TrendingUp className="w-4 h-4" />} href="/finance/profit-sheets" />
        <StatCard label="Total Expense" value={pkr(data?.totalExpense || 0)} tone="red" icon={<TrendingDown className="w-4 h-4" />} href="/finance/profit-sheets" />
      </div>

      <ChartCard title="Monthly Cash Flow (This Year)">
        {hasFlow ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyTrend} margin={{ left: -10, right: 10, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={compact} />
              <Tooltip formatter={(v: number) => pkr(v)} />
              <Legend />
              <Bar dataKey="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : <EmptyChart msg="No ledger data yet. Add entries in the General Ledger to see cash flow." />}
      </ChartCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="font-semibold">Bank Accounts</h2><Link href="/finance/accounts" className="text-xs text-blue-600 hover:underline">View all</Link></div>
          <div className="space-y-3">
            {bankAccounts.map((b: any) => (
              <Link key={b.id} href="/finance/accounts" className="flex items-center justify-between py-2 border-b border-gray-50 hover:bg-gray-50 -mx-1 px-1 rounded">
                <div><p className="text-sm font-medium text-gray-900">{b.name}</p><p className="text-xs text-gray-400">{b.bankName}</p></div>
                <p className={"text-sm font-bold " + (b.balance >= 0 ? "text-green-700" : "text-red-600")}>{pkr(b.balance)}</p>
              </Link>
            ))}
            {bankAccounts.length === 0 && <div className="text-center py-6"><Landmark className="w-6 h-6 text-gray-300 mx-auto mb-1" /><p className="text-sm text-gray-400">No bank accounts yet. <Link href="/finance/accounts" className="text-blue-600 hover:underline">Add one</Link></p></div>}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
          <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-orange-700">Pending Invoices</h2><Link href="/billing" className="text-xs text-blue-600 hover:underline">View all</Link></div>
          <div className="space-y-2">
            {pendingInvoices.map((inv: any) => (
              <Link key={inv.id} href={`/billing?status=${inv.status}`} className="flex items-center justify-between py-2 border-b border-gray-50 hover:bg-gray-50 -mx-1 px-1 rounded">
                <div><p className="text-sm font-medium text-gray-900">{inv.invoiceNumber}</p><p className="text-xs text-gray-400">{inv.client?.name}</p></div>
                <div className="text-right"><p className="text-sm font-bold text-gray-800">{pkr(inv.grandTotal)}</p><span className="text-xs text-orange-500 capitalize">{inv.status}</span></div>
              </Link>
            ))}
            {pendingInvoices.length === 0 && <div className="text-center py-6"><CheckCircle2 className="w-6 h-6 text-green-400 mx-auto mb-1" /><p className="text-sm text-green-600">All invoices are settled!</p></div>}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ PAGE ------------------------------ */
export default function DashboardPage() {
  const { data: session } = useSession();
  const role = session?.user?.role || "";
  const endpoint = role === "accountant" ? "/api/dashboard/accountant" : role === "manager" ? "/api/dashboard/manager" : "/api/dashboard/admin";
  const { data, isLoading } = useSWR(session ? endpoint : null, fetcher);

  if (isLoading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="text-center"><div className="w-10 h-10 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div><p className="text-gray-500 text-sm">Loading your dashboard…</p></div>
    </div>
  );

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Welcome back, {session?.user?.name?.split(" ")[0] || "User"}</h1>
          <p className="text-sm text-gray-500 capitalize">{role} Dashboard · {new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link href="/projects" className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"><FolderOpen className="w-3.5 h-3.5" />Projects</Link>
          <Link href="/tasks" className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 bg-white hover:bg-gray-50 hover:border-gray-300 transition-colors"><ClipboardList className="w-3.5 h-3.5" />Tasks</Link>
          {["admin", "ceo", "manager"].includes(role) && <Link href="/ai-assistant" className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shadow-sm"><Sparkles className="w-3.5 h-3.5" />AI Assistant</Link>}
        </div>
      </div>

      {(role === "admin" || role === "ceo") && data && <AdminDashboard data={data} />}
      {role === "manager" && data && <ManagerDashboard data={data} />}
      {role === "accountant" && data && <AccountantDashboard data={data} />}
      {!data && !isLoading && <div className="text-center py-16 text-gray-400"><BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" /><p className="font-medium text-gray-600">Dashboard loading…</p><p className="text-sm mt-1">If this persists, try refreshing the page.</p></div>}
    </div>
  );
}
