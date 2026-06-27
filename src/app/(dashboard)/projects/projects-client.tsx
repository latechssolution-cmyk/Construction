"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Search, Eye, Edit, Loader2, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, getStatusColor, getProjectProgress } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
type Role = "admin" | "ceo" | "manager" | "accountant";

const schema = z.object({
  name: z.string().min(2, "Name too short"),
  location: z.string().optional(),
  type: z.string().default("OTHER"),
  status: z.string().default("PLANNING"),
  budget: z.coerce.number().min(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  description: z.string().optional(),
  clientId: z.string().optional(),
  managerId: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface ProjectsClientProps {
  projects: any[];
  clients: { id: string; name: string }[];
  managers: { id: string; name: string }[];
  role: Role;
}

export function ProjectsClient({ projects, clients, managers, role }: ProjectsClientProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { status: "PLANNING", type: "RESIDENTIAL", budget: 0 },
  });

  const filtered = projects.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.location?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "ALL" || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const onSubmit = async (data: FormData) => {
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed");
      toast({ title: "Project created successfully" });
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to create project", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statuses = ["ALL", "PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground text-sm">{projects.length} total projects</p>
        </div>
        {(role === "admin" || role === "manager" || role === "ceo") && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />New Project</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <Label>Project Name *</Label>
                    <Input placeholder="e.g. Gulberg Residential Complex" {...register("name")} />
                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label>Location</Label>
                    <Input placeholder="City, Area" {...register("location")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Type</Label>
                    <Select defaultValue="RESIDENTIAL" onValueChange={(v) => setValue("type", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["RESIDENTIAL", "COMMERCIAL", "INDUSTRIAL", "INFRASTRUCTURE", "RENOVATION", "OTHER"].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Budget (PKR)</Label>
                    <Input type="number" placeholder="0" {...register("budget")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Status</Label>
                    <Select defaultValue="PLANNING" onValueChange={(v) => setValue("status", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"].map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Start Date</Label>
                    <Input type="date" {...register("startDate")} />
                  </div>
                  <div className="space-y-1">
                    <Label>End Date</Label>
                    <Input type="date" {...register("endDate")} />
                  </div>
                  <div className="space-y-1">
                    <Label>Client</Label>
                    <Select onValueChange={(v) => setValue("clientId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Manager</Label>
                    <Select onValueChange={(v) => setValue("managerId", v)}>
                      <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                      <SelectContent>
                        {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label>Description</Label>
                    <Textarea placeholder="Project description..." {...register("description")} />
                  </div>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create Project
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {statuses.map(s => (
            <Button
              key={s}
              variant={filterStatus === s ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterStatus(s)}
            >
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </Button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No projects found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((project) => {
            const totalIncome = project.ledgerEntries
              .filter((e: any) => e.type === "INCOME")
              .reduce((s: number, e: any) => s + Number(e.amount), 0);
            const totalExpense = project.ledgerEntries
              .filter((e: any) => e.type === "EXPENSE")
              .reduce((s: number, e: any) => s + Number(e.amount), 0);
            const progress = getProjectProgress(project.tasks ?? []);

            return (
              <Card key={project.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{project.name}</CardTitle>
                    <Badge variant="secondary" className={getStatusColor(project.status)}>
                      {project.status.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {project.location} · {project.type} · {project.client?.name ?? "No Client"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="font-semibold">{formatCurrency(Number(project.budget))}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Spent</p>
                      <p className="font-semibold text-orange-600">{formatCurrency(totalExpense)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                      <p className="font-semibold text-green-600">{formatCurrency(totalIncome)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Profit</p>
                      <p className={`font-semibold ${totalIncome - totalExpense >= 0 ? "text-green-700" : "text-red-600"}`}>
                        {formatCurrency(totalIncome - totalExpense)}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Milestone Progress</span>
                      <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1.5" />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <p className="text-xs text-muted-foreground">
                      Manager: {project.manager?.name ?? "Unassigned"}
                    </p>
                    <Link href={`/projects/${project.id}`}>
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <Eye className="w-3 h-3 mr-1" />View
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
