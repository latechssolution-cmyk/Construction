"use client";

import { formatCurrency, formatDate, getStatusColor } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, Legend } from "recharts";
import { Receipt, CreditCard, AlertCircle, Landmark } from "lucide-react";
import Link from "next/link";

export function AccountantDashboard({ data }: { data: any }) {
  const totalBalance = data.accountBalances?.reduce((s: number, a: any) => s + Number(a.balance), 0) ?? 0;
  const pendingAmount = data.pendingBills?.reduce((s: number, b: any) => s + Number(b.grandTotal), 0) ?? 0;

  const monthlyChart = [
    { name: "This Month", income: data.monthlyData?.find((d: any) => d.type === "INCOME")?._sum?.amount ?? 0, expense: data.monthlyData?.find((d: any) => d.type === "EXPENSE")?._sum?.amount ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Finance Dashboard</h1>
        <p className="text-gray-500 text-sm">Financial overview and pending items</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Balance", value: formatCurrency(totalBalance), icon: Landmark, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Pending Invoices", value: data.pendingBills?.length ?? 0, icon: AlertCircle, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Pending Amount", value: formatCurrency(pendingAmount), icon: CreditCard, color: "text-red-600", bg: "bg-red-50" },
          { label: "Recent Entries", value: data.recentLedger?.length ?? 0, icon: Receipt, color: "text-green-600", bg: "bg-green-50" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                  <p className="text-xl font-bold mt-1 truncate">{s.value}</p>
                </div>
                <div className={`${s.bg} p-2 rounded-lg ml-2`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Bills */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.pendingBills?.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending invoices</p>
            ) : (
              data.pendingBills?.map((bill: any) => (
                <div key={bill.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                  <div>
                    <p className="text-sm font-medium">{bill.billNumber}</p>
                    <p className="text-xs text-muted-foreground">{bill.client?.name} · Due {formatDate(bill.dueDate)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatCurrency(Number(bill.grandTotal))}</p>
                    <Badge variant="secondary" className={`text-xs ${getStatusColor(bill.status)}`}>{bill.status}</Badge>
                  </div>
                </div>
              ))
            )}
            <Link href="/billing" className="text-xs text-blue-600 hover:underline block pt-1">View all invoices →</Link>
          </CardContent>
        </Card>

        {/* Account Balances */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Balances</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.accountBalances?.map((acc: any) => (
              <div key={acc.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{acc.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">{acc.type} · {acc.bankName ?? ""}</p>
                </div>
                <p className="text-sm font-bold text-green-700">{formatCurrency(Number(acc.balance))}</p>
              </div>
            ))}
            <Link href="/finance/accounts" className="text-xs text-blue-600 hover:underline block pt-1">Manage accounts →</Link>
          </CardContent>
        </Card>

        {/* Recent Ledger */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Recent Ledger Entries</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.recentLedger?.map((entry: any) => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 border-b last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.description || entry.category}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.project?.name && `${entry.project.name} · `}{entry.category} · {formatDate(entry.date)}
                  </p>
                </div>
                <span className={`text-sm font-bold ml-4 flex-shrink-0 ${entry.type === "INCOME" ? "text-green-600" : "text-red-600"}`}>
                  {entry.type === "INCOME" ? "+" : "-"}{formatCurrency(Number(entry.amount))}
                </span>
              </div>
            ))}
            <Link href="/finance/ledger" className="text-xs text-blue-600 hover:underline block pt-1">View full ledger →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
