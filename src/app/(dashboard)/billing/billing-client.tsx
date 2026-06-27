"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Printer, Eye, Loader2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, formatDate, getStatusColor, generateBillNumber } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
type Role = "admin" | "ceo" | "manager" | "accountant";

interface LineItem {
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

export function BillingClient({ bills, projects, clients, role }: any) {
  const [open, setOpen] = useState(false);
  const [viewBill, setViewBill] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: "1", unit: "lump sum", unitPrice: "0" },
  ]);
  const [formData, setFormData] = useState({ clientId: "", projectId: "", paymentTerms: "30 days", notes: "", taxRate: "0", dueDate: "" });
  const { toast } = useToast();
  const router = useRouter();

  const addLine = () => setLineItems([...lineItems, { description: "", quantity: "1", unit: "pcs", unitPrice: "0" }]);
  const removeLine = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: keyof LineItem, val: string) => {
    setLineItems(lineItems.map((item, idx) => idx === i ? { ...item, [field]: val } : item));
  };

  const subtotal = lineItems.reduce((s, i) => s + (parseFloat(i.quantity) || 0) * (parseFloat(i.unitPrice) || 0), 0);
  const taxAmount = subtotal * (parseFloat(formData.taxRate) / 100 || 0);
  const grandTotal = subtotal + taxAmount;

  const onSubmit = async () => {
    if (!formData.clientId) { toast({ title: "Select a client", variant: "destructive" }); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, lineItems, status: "DRAFT" }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Invoice created" });
      setOpen(false);
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to create invoice", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const printBill = (bill: any) => {
    setViewBill(bill);
    setTimeout(() => window.print(), 300);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print">
        <div>
          <h1 className="text-2xl font-bold">Billing & Invoices</h1>
          <p className="text-muted-foreground text-sm">{bills.length} total invoices</p>
        </div>
        {["admin", "accountant"].includes(role) && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Invoice</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Client *</Label>
                    <Select onValueChange={(v) => setFormData(f => ({ ...f, clientId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>{clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Project</Label>
                    <Select onValueChange={(v) => setFormData(f => ({ ...f, projectId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Due Date</Label>
                    <Input type="date" value={formData.dueDate} onChange={e => setFormData(f => ({ ...f, dueDate: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <Label>Tax Rate (%)</Label>
                    <Input type="number" value={formData.taxRate} onChange={e => setFormData(f => ({ ...f, taxRate: e.target.value }))} />
                  </div>
                </div>

                {/* Line Items */}
                <div>
                  <Label className="text-sm font-semibold">Line Items</Label>
                  <div className="mt-2 space-y-2">
                    {lineItems.map((item, i) => (
                      <div key={i} className="grid grid-cols-12 gap-2 items-center">
                        <Input className="col-span-4" placeholder="Description" value={item.description} onChange={e => updateLine(i, "description", e.target.value)} />
                        <Input className="col-span-2" type="number" placeholder="Qty" value={item.quantity} onChange={e => updateLine(i, "quantity", e.target.value)} />
                        <Input className="col-span-2" placeholder="Unit" value={item.unit} onChange={e => updateLine(i, "unit", e.target.value)} />
                        <Input className="col-span-2" type="number" placeholder="Unit Price" value={item.unitPrice} onChange={e => updateLine(i, "unitPrice", e.target.value)} />
                        <div className="col-span-1 text-right text-sm font-medium">
                          {formatCurrency((parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0))}
                        </div>
                        <Button variant="ghost" size="icon" className="col-span-1 h-8 w-8" onClick={() => removeLine(i)}>×</Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addLine}><Plus className="w-3 h-3 mr-1" />Add Line</Button>
                  </div>
                </div>

                {/* Totals */}
                <div className="border-t pt-3 space-y-1 text-sm text-right">
                  <div className="flex justify-between"><span>Subtotal:</span><span>{formatCurrency(subtotal)}</span></div>
                  <div className="flex justify-between"><span>Tax ({formData.taxRate}%):</span><span>{formatCurrency(taxAmount)}</span></div>
                  <div className="flex justify-between font-bold text-base"><span>Grand Total:</span><span>{formatCurrency(grandTotal)}</span></div>
                </div>

                <div className="space-y-1">
                  <Label>Payment Terms</Label>
                  <Input value={formData.paymentTerms} onChange={e => setFormData(f => ({ ...f, paymentTerms: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>Notes</Label>
                  <Textarea placeholder="Additional notes..." value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))} />
                </div>

                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button onClick={onSubmit} disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create Invoice
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Bills Table */}
      <Card className="no-print">
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left px-4 py-3">Invoice #</th>
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-left px-4 py-3">Project</th>
                <th className="text-left px-4 py-3">Date</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Amount</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-muted-foreground">No invoices yet</td></tr>
              ) : (
                bills.map((bill: any) => (
                  <tr key={bill.id} className="border-b hover:bg-muted/20">
                    <td className="px-4 py-3 font-mono font-medium">{bill.billNumber}</td>
                    <td className="px-4 py-3">{bill.client?.name || "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{bill.project?.name || "—"}</td>
                    <td className="px-4 py-3">{formatDate(bill.issueDate)}</td>
                    <td className="px-4 py-3">{formatDate(bill.dueDate)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={getStatusColor(bill.status)}>{bill.status}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatCurrency(Number(bill.grandTotal))}</td>
                    <td className="px-4 py-3">
                      <Button variant="ghost" size="sm" onClick={() => printBill(bill)}>
                        <Printer className="w-3 h-3 mr-1" />Print
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Print View */}
      {viewBill && (
        <div className="print-only hidden print:block">
          <div className="max-w-3xl mx-auto p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-2xl font-bold">LA Tech Solutions</h1>
                <p className="text-sm text-gray-600">{process.env.NEXT_PUBLIC_COMPANY_ADDRESS}</p>
                <p className="text-sm text-gray-600">{process.env.NEXT_PUBLIC_COMPANY_PHONE}</p>
                <p className="text-sm text-gray-600">{process.env.NEXT_PUBLIC_COMPANY_EMAIL}</p>
              </div>
              <div className="text-right">
                <h2 className="text-xl font-bold text-gray-700">INVOICE</h2>
                <p className="font-mono text-lg">{viewBill.billNumber}</p>
                <p className="text-sm">Date: {formatDate(viewBill.issueDate)}</p>
                {viewBill.dueDate && <p className="text-sm">Due: {formatDate(viewBill.dueDate)}</p>}
              </div>
            </div>
            <div className="mb-6">
              <h3 className="font-semibold mb-1">Bill To:</h3>
              <p className="font-medium">{viewBill.client?.name}</p>
              <p className="text-sm text-gray-600">{viewBill.client?.address}</p>
              <p className="text-sm text-gray-600">{viewBill.client?.phone}</p>
            </div>
            <table className="w-full mb-6 border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="text-left py-2">Description</th>
                  <th className="text-right py-2">Qty</th>
                  <th className="text-right py-2">Unit</th>
                  <th className="text-right py-2">Unit Price</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {viewBill.lineItems?.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-2">{item.description}</td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">{item.unit}</td>
                    <td className="text-right py-2">{formatCurrency(Number(item.unitPrice))}</td>
                    <td className="text-right py-2 font-medium">{formatCurrency(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-right space-y-1">
              <div className="flex justify-end gap-8"><span>Subtotal:</span><span>{formatCurrency(Number(viewBill.subtotal))}</span></div>
              {Number(viewBill.taxAmount) > 0 && <div className="flex justify-end gap-8"><span>Tax ({viewBill.taxRate}%):</span><span>{formatCurrency(Number(viewBill.taxAmount))}</span></div>}
              <div className="flex justify-end gap-8 font-bold text-lg border-t border-gray-300 pt-1"><span>Grand Total:</span><span>{formatCurrency(Number(viewBill.grandTotal))}</span></div>
            </div>
            {viewBill.paymentTerms && <p className="mt-4 text-sm text-gray-600">Payment Terms: {viewBill.paymentTerms}</p>}
            {viewBill.notes && <p className="mt-2 text-sm text-gray-600">{viewBill.notes}</p>}
            <div className="mt-12 pt-8 border-t">
              <p className="text-sm text-gray-500">Authorized Signature: _____________________</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
