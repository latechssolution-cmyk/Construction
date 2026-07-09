"use client";
import useSWR from "swr";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { TableSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { Users, Lock } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { getRoleBadgeColor } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then(r => r.json());

export default function UsersPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: users, mutate, isLoading } = useSWR("/api/users", fetcher);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ role:"manager" });
  const [loading, setLoading] = useState(false);
  const [resetId, setResetId] = useState<string|null>(null);
  const [newPassword, setNewPassword] = useState("");

  if (!["admin"].includes(session?.user?.role||"")) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Lock className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-medium text-gray-700">Access restricted to administrators.</p>
      </div>
    );
  }

  const canCreate = session?.user?.role === "admin";
  const list: any[] = Array.isArray(users) ? users : [];

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault(); setLoading(true);
    try {
      const res = await fetch("/api/users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(form)});
      if (!res.ok) { const err=await res.json(); toast({ title: "Error", description: err.error||"Failed to create user", variant: "destructive" }); return; }
      mutate(); setShowForm(false); setForm({role:"manager"});
      toast({ title: "User created", description: `${form.name} has been added.` });
    } finally { setLoading(false); }
  }

  async function toggleActive(id: string, isActive: boolean) {
    const res = await fetch(`/api/users/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({isActive:!isActive})});
    if (!res.ok) { const err = await res.json().catch(()=>({})); toast({ title: "Error", description: err.error||"Failed to update user", variant: "destructive" }); return; }
    mutate();
  }

  async function handleReset(id: string) {
    if (!newPassword||newPassword.length<8) {
      toast({ title: "Validation error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }
    const res = await fetch(`/api/users/${id}/reset-password`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({newPassword})});
    if (res.ok) {
      toast({ title: "Password reset", description: "Password updated successfully." });
      setResetId(null); setNewPassword("");
    }
    else { const err=await res.json(); toast({ title: "Error", description: err.error||"Failed to reset password", variant: "destructive" }); }
  }

  async function handleRoleChange(id: string, role: string) {
    const res = await fetch(`/api/users/${id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({role})});
    if (!res.ok) { const err = await res.json().catch(()=>({})); toast({ title: "Error", description: err.error||"Failed to change role", variant: "destructive" }); return; }
    mutate();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="User Management"
        actions={canCreate && <button onClick={()=>setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0 shadow-sm">+ Add User</button>}
      />

      {showForm && canCreate && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Create New User</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required type="email" value={form.email||""} onChange={e=>setForm({...form,email:e.target.value})} placeholder="Email *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <input required type="password" value={form.password||""} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password (min 8 chars) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" minLength={8} />
            <select value={form.role||"manager"} onChange={e=>setForm({...form,role:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {["admin","ceo","manager","accountant"].map(r=><option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Creating...":"Create User"}</button>
            <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <TableSkeleton />
      ) : list.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<Users className="w-10 h-10" />} title="No users found" />
        </div>
      ) : (
      <>
      {/* Desktop table */}
      <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-gray-200 bg-gray-50">
            {["User","Email","Role","Status","Joined","Actions"].map(h=><th key={h} className="text-left py-3 px-4 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
          </tr></thead>
          <tbody>
            {list.map((u:any)=>(
              <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">
                      {u.image ? <img src={u.image} className="w-8 h-8 rounded-full object-cover" alt={u.name} /> : u.name?.[0]?.toUpperCase()||"U"}
                    </div>
                    <span className="font-medium text-gray-900">{u.name}</span>
                  </div>
                </td>
                <td className="py-3 px-4 text-gray-500">{u.email}</td>
                <td className="py-3 px-4">
                  {session?.user?.role==="admin" ? (
                    <select value={u.role} onChange={e=>handleRoleChange(u.id,e.target.value)} className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${getRoleBadgeColor(u.role)}`}>
                      {["admin","ceo","manager","accountant"].map(r=><option key={r} value={r}>{r}</option>)}
                    </select>
                  ) : (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(u.role)}`}>{u.role}</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>{u.isActive?"Active":"Inactive"}</span>
                </td>
                <td className="py-3 px-4 text-gray-400 text-xs whitespace-nowrap">{u.createdAt?new Date(u.createdAt).toLocaleDateString():"—"}</td>
                <td className="py-3 px-4">
                  <div className="flex gap-2">
                    {u.id!==session?.user?.id && (
                      <button onClick={()=>toggleActive(u.id,u.isActive)} className={`text-xs hover:underline ${u.isActive?"text-orange-500":"text-green-600"}`}>{u.isActive?"Deactivate":"Activate"}</button>
                    )}
                    {resetId===u.id ? (
                      <div className="flex gap-1 items-center">
                        <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password" className="border border-gray-200 rounded px-2 py-0.5 text-xs w-28" />
                        <button onClick={()=>handleReset(u.id)} className="text-xs text-blue-600 hover:underline">Set</button>
                        <button onClick={()=>{setResetId(null);setNewPassword("");}} className="text-xs text-gray-400 hover:underline">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={()=>setResetId(u.id)} className="text-xs text-blue-500 hover:underline">Reset Password</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {list.map((u:any)=>(
          <div key={u.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                  {u.image ? <img src={u.image} className="w-9 h-9 rounded-full object-cover" alt={u.name} /> : u.name?.[0]?.toUpperCase()||"U"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-500 truncate">{u.email}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${u.isActive?"bg-green-100 text-green-700":"bg-gray-100 text-gray-500"}`}>{u.isActive?"Active":"Inactive"}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs items-center">
              <div className="flex items-center gap-1">
                <span className="text-gray-400">Role: </span>
                {session?.user?.role==="admin" ? (
                  <select value={u.role} onChange={e=>handleRoleChange(u.id,e.target.value)} className={`text-xs px-2 py-0.5 rounded-full border-0 cursor-pointer ${getRoleBadgeColor(u.role)}`}>
                    {["admin","ceo","manager","accountant"].map(r=><option key={r} value={r}>{r}</option>)}
                  </select>
                ) : (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getRoleBadgeColor(u.role)}`}>{u.role}</span>
                )}
              </div>
              <div><span className="text-gray-400">Joined: </span><span className="text-gray-700 whitespace-nowrap">{u.createdAt?new Date(u.createdAt).toLocaleDateString():"—"}</span></div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 flex-wrap items-center">
              {u.id!==session?.user?.id && (
                <button onClick={()=>toggleActive(u.id,u.isActive)} className={`text-xs hover:underline ${u.isActive?"text-orange-500":"text-green-600"}`}>{u.isActive?"Deactivate":"Activate"}</button>
              )}
              {resetId===u.id ? (
                <div className="flex gap-1 items-center">
                  <input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password" className="border border-gray-200 rounded px-2 py-0.5 text-xs w-28 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
                  <button onClick={()=>handleReset(u.id)} className="text-xs text-blue-600 hover:underline">Set</button>
                  <button onClick={()=>{setResetId(null);setNewPassword("");}} className="text-xs text-gray-400 hover:underline">Cancel</button>
                </div>
              ) : (
                <button onClick={()=>setResetId(u.id)} className="text-xs text-blue-500 hover:underline">Reset Password</button>
              )}
            </div>
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
