"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { StatsSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { Lock, TrendingUp, TrendingDown, Scale, Search, PieChart, HandCoins } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function ProfitSheetsPage() {
  const { data: session } = useSession();
  const year = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(year);
  const [projectSearch, setProjectSearch] = useState("");
  const [view, setView] = useState<"pnl" | "investors">("pnl");
  const { data: summary, isLoading } = useSWR(`/api/ledger/summary?year=${selectedYear}`, fetcher);
  const { data: partnersRaw } = useSWR(view === "investors" ? "/api/partners" : null, fetcher);
  const { data: investmentsRaw } = useSWR(view === "investors" ? "/api/investments" : null, fetcher);
  const { data: projectsRaw } = useSWR("/api/projects", fetcher);
  const projects: any[] = projectsRaw?.data ? projectsRaw.data : (Array.isArray(projectsRaw) ? projectsRaw : []);

  if (session && !["admin","ceo","accountant"].includes(session.user?.role || "")) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="font-medium">Access Restricted</p>
        <p className="text-sm mt-1">Profit &amp; Loss statements are visible to finance roles only.</p>
      </div>
    );
  }

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthly: any[] = summary?.monthly || [];
  const byCategory: any[] = summary?.byCategory || [];
  const totals = summary?.totals || {};

  const incomeCategories = byCategory.filter((c:any)=>c.type==="income");
  const expenseCategories = byCategory.filter((c:any)=>c.type==="expense");

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Profit & Loss Statement"
        actions={
          <select value={selectedYear} onChange={e=>setSelectedYear(parseInt(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-auto shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500/40">
            {[year-1,year,year+1].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
        }
      />

      <div className="flex gap-1.5 bg-gray-100 p-1 rounded-lg w-fit">
        <button onClick={() => setView("pnl")} className={"flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium transition-colors " + (view === "pnl" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}><Scale className="w-3.5 h-3.5" /> Profit &amp; Loss</button>
        <button onClick={() => setView("investors")} className={"flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md font-medium transition-colors " + (view === "investors" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700")}><PieChart className="w-3.5 h-3.5" /> Investor Shares</button>
      </div>

      {view === "pnl" && (<>
      {isLoading ? <StatsSkeleton count={3} /> : (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Revenue" value={`PKR ${(totals.totalIncome||0).toLocaleString()}`} tone="green" icon={<TrendingUp className="w-4 h-4" />} />
        <StatCard label="Total Expenses" value={`PKR ${(totals.totalExpense||0).toLocaleString()}`} tone="red" icon={<TrendingDown className="w-4 h-4" />} />
        <StatCard
          label="Net Profit / Loss"
          value={`PKR ${(totals.net||0).toLocaleString()}`}
          tone={(totals.net||0)>=0?"blue":"orange"}
          icon={<Scale className="w-4 h-4" />}
          sub={totals.totalIncome>0 ? `Margin: ${((totals.net/totals.totalIncome)*100).toFixed(1)}%` : undefined}
        />
      </div>
      )}

      {isLoading ? <TableSkeleton /> : (<>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50"><h2 className="font-semibold">Monthly Trend {selectedYear}</h2></div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-gray-500 text-xs">
              <th className="text-left py-2">Month</th>
              <th className="text-right py-2 text-green-600">Income</th>
              <th className="text-right py-2 text-red-500">Expense</th>
              <th className="text-right py-2 text-blue-600">Net</th>
              <th className="py-2 w-48 text-left pl-4">P&L Bar</th>
            </tr></thead>
            <tbody>
              {monthNames.map((m,i)=>{
                const row = monthly.find((r:any)=>r.month===i+1)||{income:0,expense:0};
                const net = (row.income||0)-(row.expense||0);
                const maxVal = Math.max(...monthly.map((r:any)=>Math.max(r.income||0,r.expense||0)),1);
                const incPct = ((row.income||0)/maxVal)*100;
                const expPct = ((row.expense||0)/maxVal)*100;
                return (
                  <tr key={m} className="border-t border-gray-100">
                    <td className="py-2 font-medium text-gray-700">{m}</td>
                    <td className="py-2 text-right text-green-600">{(row.income||0)>0?`PKR ${(row.income||0).toLocaleString()}`:"—"}</td>
                    <td className="py-2 text-right text-red-500">{(row.expense||0)>0?`PKR ${(row.expense||0).toLocaleString()}`:"—"}</td>
                    <td className={`py-2 text-right font-medium ${net>=0?"text-blue-600":"text-orange-600"}`}>{net!==0?`PKR ${net.toLocaleString()}`:"—"}</td>
                    <td className="py-2 pl-4">
                      <div className="space-y-0.5">
                        <div className="h-2 rounded bg-green-200" style={{width:`${incPct}%`}}></div>
                        <div className="h-2 rounded bg-red-200" style={{width:`${expPct}%`}}></div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-green-50"><h2 className="font-semibold text-green-800">Income Breakdown</h2></div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="text-left py-2 px-4 text-xs text-gray-500">Category</th><th className="text-right py-2 px-4 text-xs text-gray-500">Amount</th><th className="text-right py-2 px-4 text-xs text-gray-500">%</th></tr></thead>
            <tbody>
              {incomeCategories.map((c:any)=>(
                <tr key={c.category} className="border-b border-gray-100">
                  <td className="py-2 px-4 capitalize text-gray-700">{c.category?.replace("_"," ")}</td>
                  <td className="py-2 px-4 text-right text-green-600 font-medium">PKR {c._sum?.amount?.toLocaleString()}</td>
                  <td className="py-2 px-4 text-right text-gray-400">{totals.totalIncome>0?(((c._sum?.amount||0)/totals.totalIncome)*100).toFixed(1):0}%</td>
                </tr>
              ))}
              {incomeCategories.length===0&&<tr><td colSpan={3} className="py-6 text-center text-gray-400 text-sm">No income data</td></tr>}
            </tbody>
          </table>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-red-50"><h2 className="font-semibold text-red-800">Expense Breakdown</h2></div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-100 bg-gray-50"><th className="text-left py-2 px-4 text-xs text-gray-500">Category</th><th className="text-right py-2 px-4 text-xs text-gray-500">Amount</th><th className="text-right py-2 px-4 text-xs text-gray-500">%</th></tr></thead>
            <tbody>
              {expenseCategories.map((c:any)=>(
                <tr key={c.category} className="border-b border-gray-100">
                  <td className="py-2 px-4 capitalize text-gray-700">{c.category?.replace("_"," ")}</td>
                  <td className="py-2 px-4 text-right text-red-500 font-medium">PKR {c._sum?.amount?.toLocaleString()}</td>
                  <td className="py-2 px-4 text-right text-gray-400">{totals.totalExpense>0?(((c._sum?.amount||0)/totals.totalExpense)*100).toFixed(1):0}%</td>
                </tr>
              ))}
              {expenseCategories.length===0&&<tr><td colSpan={3} className="py-6 text-center text-gray-400 text-sm">No expense data</td></tr>}
            </tbody>
          </table>
          </div>
        </div>
      </div>

      {projects.length>0 && (() => {
        const filteredProjects = projects.filter((p: any) =>
          !projectSearch ||
          p.name?.toLowerCase().includes(projectSearch.toLowerCase()) ||
          p.type?.toLowerCase().includes(projectSearch.toLowerCase()) ||
          p.status?.toLowerCase().includes(projectSearch.toLowerCase())
        );
        return (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 className="font-semibold">Project Overview</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={projectSearch} onChange={e=>setProjectSearch(e.target.value)} placeholder="Search projects..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b border-gray-200">
              <th className="text-left py-2 px-4 text-xs text-gray-500">Project</th>
              <th className="text-left py-2 px-4 text-xs text-gray-500">Type</th>
              <th className="text-left py-2 px-4 text-xs text-gray-500">Status</th>
              <th className="text-right py-2 px-4 text-xs text-gray-500">Budget (PKR)</th>
              <th className="text-right py-2 px-4 text-xs text-gray-500">Actual Revenue</th>
              <th className="text-right py-2 px-4 text-xs text-gray-500">Actual Expense</th>
              <th className="text-right py-2 px-4 text-xs text-gray-500">Actual Profit</th>
              <th className="text-right py-2 px-4 text-xs text-gray-500">Task Progress</th>
            </tr></thead>
            <tbody>
              {filteredProjects.length===0 && (
                <tr><td colSpan={8} className="py-6 text-center text-gray-400 text-sm">No projects match your search</td></tr>
              )}
              {filteredProjects.map((p:any)=>{
                const totalTasks = p.tasks?.length||0;
                let pct = p.completionPercent || 0;
                if (totalTasks > 0) {
                  const totalWeight = p.tasks.reduce((sum: number, t: any) => sum + (t.weight || 1), 0);
                  const completedWeight = p.tasks.filter((t: any) => t.status === "completed").reduce((sum: number, t: any) => sum + (t.weight || 1), 0);
                  pct = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
                }
                const actualProfit = (p.actualRevenue || 0) - (p.actualExpense || 0);
                return (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-4 font-medium text-gray-900">{p.name}</td>
                    <td className="py-2 px-4 text-gray-500 capitalize">{p.type?.replace("_"," ")||"—"}</td>
                    <td className="py-2 px-4"><span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize">{p.status?.replace("_"," ")}</span></td>
                    <td className="py-2 px-4 text-right font-medium text-gray-800">{(p.budget||0).toLocaleString()}</td>
                    <td className="py-2 px-4 text-right text-green-600 font-medium">PKR {(p.actualRevenue||0).toLocaleString()}</td>
                    <td className="py-2 px-4 text-right text-red-500 font-medium">PKR {(p.actualExpense||0).toLocaleString()}</td>
                    <td className={`py-2 px-4 text-right font-bold ${actualProfit >= 0 ? "text-green-600" : "text-red-500"}`}>
                      PKR {actualProfit.toLocaleString()}
                    </td>
                    <td className="py-2 px-4">
                      <div className="flex items-center gap-2 justify-end">
                        <div className="w-24 bg-gray-100 rounded-full h-2"><div className="bg-blue-500 h-2 rounded-full" style={{width:`${pct}%`}}></div></div>
                        <span className="text-xs text-gray-500 w-8">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </div>
        );
      })()}
      </>)}
      </>)}

      {view === "investors" && (() => {
        const partners: any[] = (Array.isArray(partnersRaw) ? partnersRaw : []).filter((pt: any) => pt.isActive !== false);
        const investments: any[] = Array.isArray(investmentsRaw) ? investmentsRaw : [];
        const investedByPartner: Record<string, number> = {};
        for (const inv of investments) {
          const pid = inv.partnerId?.toString?.() || inv.partner?.id || "";
          if (pid) investedByPartner[pid] = (investedByPartner[pid] || 0) + (inv.amount || 0);
        }
        const net = totals.net || 0;
        const totalEquity = partners.reduce((sum: number, pt: any) => sum + (pt.equityPercent || 0), 0);
        const totalInvested = investments.reduce((sum: number, inv: any) => sum + (inv.amount || 0), 0);
        const withEquity = partners.filter((pt: any) => (pt.equityPercent || 0) > 0);
        return (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard label={`Net Profit ${selectedYear}`} value={`PKR ${net.toLocaleString()}`} tone={net >= 0 ? "green" : "orange"} icon={<Scale className="w-4 h-4" />} />
              <StatCard label="Equity Allocated" value={`${totalEquity}%`} sub={totalEquity < 100 ? `${(100 - totalEquity).toFixed(1)}% company-held` : undefined} tone={totalEquity > 100 ? "red" : "purple"} icon={<PieChart className="w-4 h-4" />} />
              <StatCard label="Total Partner Capital" value={`PKR ${totalInvested.toLocaleString()}`} sub="Invested across projects" tone="blue" icon={<HandCoins className="w-4 h-4" />} />
            </div>

            {totalEquity > 100 && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                Equity percentages add up to {totalEquity}% (more than 100%). Fix partner equity in People / Partners before relying on these shares.
              </div>
            )}

            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <h2 className="font-semibold">Investor Shares — {selectedYear} P&amp;L</h2>
                <p className="text-xs text-gray-400 mt-0.5">Each share = the partner&apos;s equity % applied to this year&apos;s revenue, expenses, and net profit. Equity is set in People / Partners.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2 px-4 text-xs text-gray-500">Partner</th>
                    <th className="text-right py-2 px-4 text-xs text-gray-500">Equity %</th>
                    <th className="text-right py-2 px-4 text-xs text-gray-500">Invested Capital</th>
                    <th className="text-right py-2 px-4 text-xs text-gray-500">Share of Revenue</th>
                    <th className="text-right py-2 px-4 text-xs text-gray-500">Share of Expenses</th>
                    <th className="text-right py-2 px-4 text-xs text-gray-500">Share of Net Profit</th>
                  </tr></thead>
                  <tbody>
                    {withEquity.length === 0 && (
                      <tr><td colSpan={6} className="py-8 text-center text-gray-400 text-sm">No partners with an equity share yet. Set equity % in People / Partners.</td></tr>
                    )}
                    {withEquity.map((pt: any) => {
                      const eq = (pt.equityPercent || 0) / 100;
                      const shareNet = net * eq;
                      return (
                        <tr key={pt.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-2.5 px-4 font-medium text-gray-900">{pt.name}</td>
                          <td className="py-2.5 px-4 text-right text-purple-700 font-medium">{pt.equityPercent}%</td>
                          <td className="py-2.5 px-4 text-right text-gray-700">PKR {(investedByPartner[pt.id] || 0).toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-right text-green-600">PKR {Math.round((totals.totalIncome || 0) * eq).toLocaleString()}</td>
                          <td className="py-2.5 px-4 text-right text-red-500">PKR {Math.round((totals.totalExpense || 0) * eq).toLocaleString()}</td>
                          <td className={`py-2.5 px-4 text-right font-bold ${shareNet >= 0 ? "text-green-600" : "text-red-500"}`}>PKR {Math.round(shareNet).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {withEquity.length > 0 && (
                    <tfoot><tr className="border-t border-gray-200 bg-gray-50 font-semibold">
                      <td className="py-2.5 px-4 text-gray-700">Total ({withEquity.length} partner{withEquity.length !== 1 ? "s" : ""})</td>
                      <td className="py-2.5 px-4 text-right text-purple-700">{totalEquity}%</td>
                      <td className="py-2.5 px-4 text-right text-gray-700">PKR {totalInvested.toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right text-green-600">PKR {Math.round((totals.totalIncome || 0) * totalEquity / 100).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right text-red-500">PKR {Math.round((totals.totalExpense || 0) * totalEquity / 100).toLocaleString()}</td>
                      <td className="py-2.5 px-4 text-right text-blue-700">PKR {Math.round(net * totalEquity / 100).toLocaleString()}</td>
                    </tr></tfoot>
                  )}
                </table>
              </div>
            </div>

            {partners.some((pt: any) => !(pt.equityPercent > 0)) && (
              <p className="text-xs text-gray-400">
                {partners.filter((pt: any) => !(pt.equityPercent > 0)).length} partner(s) without an equity % are not shown — set their share in People / Partners to include them.
              </p>
            )}
          </>
        );
      })()}
    </div>
  );
}
