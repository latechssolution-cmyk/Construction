"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Plus, AlertTriangle, Package, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
type Role = "admin" | "ceo" | "manager" | "accountant";

export function MaterialsClient({ materials, projects, vendors, role }: any) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const { toast } = useToast();
  const router = useRouter();
  const { register, handleSubmit, reset, setValue } = useForm<any>();

  const filtered = materials.filter((m: any) => {
    const stock = Number(m.quantityReceived) - Number(m.quantityUsed);
    const isLow = stock <= Number(m.lowStockThreshold);
    if (filter === "LOW") return isLow;
    if (filter !== "ALL") return m.projectId === filter;
    return true;
  });

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Material logged successfully" });
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast({ title: "Error", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const lowStockCount = materials.filter((m: any) => {
    const stock = Number(m.quantityReceived) - Number(m.quantityUsed);
    return stock <= Number(m.lowStockThreshold);
  }).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Materials & Inventory</h1>
          <p className="text-muted-foreground text-sm">{materials.length} material entries{lowStockCount > 0 && <span className="text-orange-600 ml-2">· {lowStockCount} low stock</span>}</p>
        </div>
        {["admin", "manager"].includes(role) && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-2" />Log Material</Button></DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Log Material Receipt</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label>Item Name *</Label>
                    <Input placeholder="e.g. Cement, Steel Bars" {...register("itemName", { required: true })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Category</Label>
                    <Input placeholder="binding, steel, masonry..." {...register("category")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Unit *</Label>
                    <Input placeholder="bags, kg, pieces, m³" {...register("unit", { required: true })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Qty Received *</Label>
                    <Input type="number" step="0.01" {...register("quantityReceived", { required: true })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Unit Price (PKR) *</Label>
                    <Input type="number" step="0.01" {...register("unitPrice", { required: true })} />
                  </div>
                  <div className="space-y-1">
                    <Label>Low Stock Alert</Label>
                    <Input type="number" step="0.01" placeholder="0" {...register("lowStockThreshold")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Date</Label>
                    <Input type="date" defaultValue={new Date().toISOString().split("T")[0]} {...register("receivedDate")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Project *</Label>
                    <Select onValueChange={(v) => setValue("projectId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Vendor</Label>
                    <Select onValueChange={(v) => setValue("vendorId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                      <SelectContent>{vendors.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={loading}>{loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Log Material</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={filter === "ALL" ? "default" : "outline"} size="sm" onClick={() => setFilter("ALL")}>All</Button>
        <Button variant={filter === "LOW" ? "default" : "outline"} size="sm" onClick={() => setFilter("LOW")} className="border-orange-300">
          <AlertTriangle className="w-3 h-3 mr-1 text-orange-500" />Low Stock ({lowStockCount})
        </Button>
        {projects.map((p: any) => (
          <Button key={p.id} variant={filter === p.id ? "default" : "outline"} size="sm" onClick={() => setFilter(p.id)}>{p.name}</Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3">Item</th>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Vendor</th>
                <th className="text-right px-4 py-3">Received</th>
                <th className="text-right px-4 py-3">Used</th>
                <th className="text-right px-4 py-3">Stock</th>
                <th className="text-right px-4 py-3">Unit Price</th>
                <th className="text-right px-4 py-3">Total Cost</th>
                <th className="text-left px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground"><Package className="w-8 h-8 mx-auto mb-2 opacity-30" /><p>No materials logged</p></td></tr>
              ) : (
                filtered.map((m: any) => {
                  const stock = Number(m.quantityReceived) - Number(m.quantityUsed);
                  const isLow = stock <= Number(m.lowStockThreshold);
                  return (
                    <tr key={m.id} className={`border-b hover:bg-muted/20 ${isLow ? "bg-orange-50/50" : ""}`}>
                      <td className="px-4 py-3">
                        <p className="font-medium">{m.itemName}</p>
                        {m.category && <p className="text-xs text-muted-foreground">{m.category}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{m.project?.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m.vendor?.name || "—"}</td>
                      <td className="px-4 py-3 text-right">{Number(m.quantityReceived)} {m.unit}</td>
                      <td className="px-4 py-3 text-right">{Number(m.quantityUsed)} {m.unit}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={isLow ? "text-orange-600 font-semibold" : "text-green-700"}>
                          {stock} {m.unit} {isLow && "⚠️"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatCurrency(Number(m.unitPrice))}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(Number(m.quantityReceived) * Number(m.unitPrice))}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(m.receivedDate)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
