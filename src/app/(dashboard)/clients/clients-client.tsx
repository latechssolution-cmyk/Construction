"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Plus, Search, Phone, Mail, Building, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, getStatusColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
type Role = "admin" | "ceo" | "manager" | "accountant";

export function ClientsClient({ clients, role }: { clients: any[]; role: Role }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();
  const { register, handleSubmit, reset, formState: { errors } } = useForm<any>();

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  );

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Client added successfully" });
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to add client", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground text-sm">{clients.length} active clients</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Client</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Add New Client</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Full Name / Company *</Label>
                  <Input placeholder="Ahmed Construction Corp" {...register("name", { required: true })} />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@example.com" {...register("email")} />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input placeholder="+92 XXX XXXXXXX" {...register("phone")} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>CNIC / Company Reg</Label>
                  <Input placeholder="35201-XXXXXXX-X" {...register("cnicOrReg")} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Address</Label>
                  <Input placeholder="City, Area" {...register("address")} />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Notes</Label>
                  <Textarea placeholder="Any remarks or follow-up notes..." {...register("notes")} />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Add Client
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input className="pl-9 max-w-md" placeholder="Search clients..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No clients found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((client) => {
            const totalPaid = client.payments
              .filter((p: any) => p.type === "INCOME")
              .reduce((s: number, p: any) => s + Number(p.amount), 0);
            return (
              <Card key={client.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Building className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{client.name}</CardTitle>
                        {client.cnicOrReg && <p className="text-xs text-muted-foreground">{client.cnicOrReg}</p>}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1 text-sm">
                    {client.email && <div className="flex items-center gap-2"><Mail className="w-3 h-3 text-muted-foreground" />{client.email}</div>}
                    {client.phone && <div className="flex items-center gap-2"><Phone className="w-3 h-3 text-muted-foreground" />{client.phone}</div>}
                    {client.address && <p className="text-muted-foreground text-xs">{client.address}</p>}
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground">Projects</p>
                      <p className="text-sm font-semibold">{client.projects.length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Paid</p>
                      <p className="text-sm font-semibold text-green-700">{formatCurrency(totalPaid)}</p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {client.projects.slice(0, 2).map((p: any) => (
                        <Badge key={p.id} variant="secondary" className={`text-xs ${getStatusColor(p.status)}`}>{p.status}</Badge>
                      ))}
                    </div>
                  </div>
                  {client.notes && <p className="text-xs text-muted-foreground border-t pt-2 italic">{client.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
