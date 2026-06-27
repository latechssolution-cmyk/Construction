"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Plus, Filter, TrendingUp, TrendingDown, DollarSign, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
type Role = "admin" | "ceo" | "manager" | "accountant";

const CATEGORIES = ["material", "labor", "equipment", "utility", "overhead", "client-payment", "vendor-payment", "advance", "other"];

export function LedgerClient({ entries, projects, accounts, totalIncome, totalExpense, role }: any) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("ALL");
  const [filterProject, setFilterProject] = useState("ALL");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const router = useRouter();
  const { register, handleSubmit, reset, setValue, watch } = useForm<any>({
    defaultValues: { date: new Date().toISOString().split("T")[0], type: "expense" },
  });

  const filtered = entries.filter((e: any) => {
    const matchType = filterType === "ALL" || e.type === filterType;
    const matchProject = filterProject === "ALL" || e.projectId === filterProject;
    const matchSearch = !search || e.description?.toLowerCase().includes(search.toLowerCase()) || e.category?.includes(search);
    return matchType && matchProject && matchSearch;
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Entry added successfully" });
      setOpen(false);
      reset({ date: new Date().toISOString().split("T")[0], type: "EXPENSE" });
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to add entry", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Ledger</h1>
          <p className="text-muted-foreground text-sm">All income and expense entries</p>
        </div>
        {["admin", "accountant"].includes(role) && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Entry</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Add Ledger Entry</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Date *</Label>
                    <Input type="date" {...register("date", { required: true })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Type *</Label>
                    <Select defaultValue="expense" onValueChange={(v) => setValue("type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="income">Income</SelectItem>
                        <SelectItem value="expense">Expense</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Amount (PKR) *</Label>
                    <Input type="number" placeholder="0" {...register("amount", { required: true })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Category *</Label>
                    <Select onValueChange={(v) => setValue("category", v)}>
                      <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Project</Label>
                    <Select onValueChange={(v) => setValue("projectId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Account</Label>
                    <Select onValueChange={(v) => setValue("bankAccountId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Reference (Cheque #, TXN ID)</Label>
                    <Input placeholder="Optional reference" {...register("reference")} />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Description</Label>
                    <Textarea placeholder="Entry details..." {...register("description")} />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Entry
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Income</p>
                <p className="text-lg font-bold text-green-700">{formatCurrency(totalIncome)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Expenses</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(totalExpense)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${totalIncome - totalExpense >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
                <DollarSign className={`w-5 h-5 ${totalIncome - totalExpense >= 0 ? "text-emerald-600" : "text-red-600"}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Net Balance</p>
                <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? "text-emerald-700" : "text-red-600"}`}>{formatCurrency(totalIncome - totalExpense)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Input className="max-w-xs" placeholder="Search entries..." value={search} onChange={e => setSearch(e.target.value)} />
        <Select defaultValue="ALL" onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="income">Income</SelectItem>
            <SelectItem value="expense">Expense</SelectItem>
          </SelectContent>
        </Select>
        <Select defaultValue="ALL" onValueChange={setFilterProject}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All Projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Projects</SelectItem>
            {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Type</th>
                  <th className="text-left px-4 py-3 font-medium">Category</th>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-left px-4 py-3 font-medium">Project</th>
                  <th className="text-left px-4 py-3 font-medium">Account</th>
                  <th className="text-right px-4 py-3 font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">No entries found</td></tr>
                ) : (
                  filtered.map((entry: any) => (
                    <tr key={entry.id} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(entry.date)}</td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className={entry.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                          {entry.type}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 capitalize">{entry.category}</td>
                      <td className="px-4 py-3 max-w-xs truncate">{entry.description || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{entry.project?.name || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{entry.bankAccount?.name || "—"}</td>
                      <td className={`px-4 py-3 text-right font-semibold ${entry.type === "income" ? "text-green-700" : "text-red-600"}`}>
                        {entry.type === "income" ? "+" : "-"}{formatCurrency(Number(entry.amount))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
