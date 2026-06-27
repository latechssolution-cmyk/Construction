"use client";

import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { Building2, TrendingUp, TrendingDown, Users, DollarSign, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

interface DashboardData {
  totalProjects: number;
  activeProjects: number;
  totalClients: number;
  totalVendors: number;
  monthlyIncome: number;
  monthlyExpense: number;
  totalIncome: number;
  totalExpense: number;
  recentLedger: any[];
  projectStats: any[];
  accountBalances: any[];
  notifications: any[];
}

export function AdminCEODashboard({ data }: { data: DashboardData }) {
  const netProfit = data.totalIncome - data.totalExpense;
  const monthlyNet = data.monthlyIncome - data.monthlyExpense;

  // Build project profit data for bar chart
  const projectChartData = data.projectStats.map((p) => {
    const income = p.ledgerEntries
      .filter((e: any) => e.type === "INCOME")
      .reduce((s: number, e: any) => s + Number(e.amount), 0);
    const expense = p.ledgerEntries
      .filter((e: any) => e.type === "EXPENSE")
      .reduce((s: number, e: any) => s + Number(e.amount), 0);
    return {
      name: p.name.length > 15 ? p.name.slice(0, 15) + "…" : p.name,
      income, expense, profit: income - expense,
    };
  });

  // Expense category breakdown (mock based on recent ledger)
  const categoryMap: Record<string, number> = {};
  data.recentLedger
    .filter((e) => e.type === "EXPENSE")
    .forEach((e) => {
      categoryMap[e.category] = (categoryMap[e.category] ?? 0) + Number(e.amount);
    });
  const pieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));

  const statCards = [
    {
      label: "Total Projects",
      value: data.totalProjects,
      sub: `${data.activeProjects} active`,
      icon: Building2,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Total Revenue",
      value: formatCurrency(data.totalIncome),
      sub: `${formatCurrency(data.monthlyIncome)} this month`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Total Expenses",
      value: formatCurrency(data.totalExpense),
      sub: `${formatCurrency(data.monthlyExpense)} this month`,
      icon: TrendingDown,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "Net Profit",
      value: formatCurrency(netProfit),
      sub: `${formatCurrency(monthlyNet)} this month`,
      icon: DollarSign,
      color: netProfit >= 0 ? "text-emerald-600" : "text-red-600",
      bg: netProfit >= 0 ? "bg-emerald-50" : "bg-red-50",
    },
    {
      label: "Clients",
      value: data.totalClients,
      sub: "Active clients",
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "Vendors",
      value: data.totalVendors,
      sub: "Active suppliers",
      icon: Activity,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm">Overview of your construction business</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => (
          <Card key={card.label} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground truncate">{card.label}</p>
                  <p className="text-xl font-bold mt-1 truncate">{card.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{card.sub}</p>
                </div>
                <div className={`${card.bg} p-2 rounded-lg ml-2 flex-shrink-0`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar Chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Project Revenue vs Expense</CardTitle>
          </CardHeader>
          <CardContent>
            {projectChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={projectChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="income" name="Revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No project data yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-60 flex items-center justify-center text-muted-foreground text-sm">
                No expense data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.accountBalances.length === 0 ? (
              <p className="text-sm text-muted-foreground">No accounts</p>
            ) : (
              data.accountBalances.map((acc: any) => (
                <div key={acc.id} className="flex items-center justify-between py-1 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{acc.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{acc.type}</p>
                  </div>
                  <p className="text-sm font-bold text-green-700">{formatCurrency(Number(acc.balance))}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentLedger.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions yet</p>
            ) : (
              data.recentLedger.slice(0, 8).map((entry: any) => (
                <div key={entry.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{entry.description || entry.category}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.project?.name && `${entry.project.name} · `}{formatDate(entry.date)}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ml-3 flex-shrink-0 ${entry.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                    {entry.type === "INCOME" ? "+" : "-"}{formatCurrency(Number(entry.amount))}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
