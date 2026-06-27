"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Plus, User, Shield, ToggleLeft, ToggleRight, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs } from "@radix-ui/react-tabs";
import { formatDateTime, getRoleBadgeColor } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export function UsersClient({ users, auditLogs }: any) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"users" | "audit">("users");
  const { toast } = useToast();
  const router = useRouter();
  const { register, handleSubmit, reset, setValue } = useForm<any>();

  const onSubmit = async (data: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      toast({ title: "User created successfully" });
      setOpen(false);
      reset();
      router.refresh();
    } catch {
      toast({ title: "Error", description: "Failed to create user", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleUser = async (id: string, isActive: boolean) => {
    await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: !isActive }),
    });
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-muted-foreground text-sm">{users.length} system users</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create System User</DialogTitle></DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-1">
                <Label>Full Name *</Label>
                <Input placeholder="John Doe" {...register("name", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" placeholder="john@latech.com" {...register("email", { required: true })} />
              </div>
              <div className="space-y-1">
                <Label>Password *</Label>
                <Input type="password" placeholder="Min 8 characters" {...register("password", { required: true, minLength: 8 })} />
              </div>
              <div className="space-y-1">
                <Label>Role *</Label>
                <Select onValueChange={(v) => setValue("role", v)}>
                  <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="ceo">CEO</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Create User
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={activeTab === "users" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("users")}>
          <User className="w-4 h-4 mr-2" />Users
        </Button>
        <Button variant={activeTab === "audit" ? "default" : "outline"} size="sm" onClick={() => setActiveTab("audit")}>
          <Clock className="w-4 h-4 mr-2" />Audit Log
        </Button>
      </div>

      {activeTab === "users" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {users.map((user: any) => (
            <Card key={user.id} className={!user.isActive ? "opacity-60" : ""}>
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold truncate">{user.name}</p>
                      <Badge className={getRoleBadgeColor(user.role)} variant="secondary">{user.role}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <div className="flex items-center justify-between mt-3">
                      <Badge variant="secondary" className={user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}>
                        {user.isActive ? "Active" : "Inactive"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleUser(user.id, user.isActive)}
                        className="h-7 text-xs"
                      >
                        {user.isActive ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                        {user.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-3">Time</th>
                  <th className="text-left px-4 py-3">Action</th>
                  <th className="text-left px-4 py-3">Entity</th>
                  <th className="text-left px-4 py-3">By</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-12 text-muted-foreground">No audit logs yet</td></tr>
                ) : (
                  auditLogs.map((log: any) => (
                    <tr key={log.id} className="border-b hover:bg-muted/20">
                      <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(log.createdAt)}</td>
                      <td className="px-4 py-2">
                        <Badge variant="secondary" className={log.action === "DELETE" ? "bg-red-100 text-red-700" : log.action === "CREATE" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">{log.entity} {log.entityId ? `(${log.entityId.slice(0, 8)}...)` : ""}</td>
                      <td className="px-4 py-2 text-muted-foreground">{log.user?.name || log.userEmail}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
