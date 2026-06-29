"use client";
import React from "react";
import useSWR from "swr";
import { useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { CardGridSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/hooks/use-toast";
import { FolderOpen, FileText, Ruler, BarChart2, Receipt, Scale, ImageIcon, File } from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const TYPE_ICONS: Record<string, React.ReactNode> = {
  contract: <FileText className="w-6 h-6 text-blue-400" />,
  drawing: <Ruler className="w-6 h-6 text-purple-400" />,
  report: <BarChart2 className="w-6 h-6 text-green-400" />,
  invoice: <Receipt className="w-6 h-6 text-orange-400" />,
  permit: <Scale className="w-6 h-6 text-yellow-500" />,
  photo: <ImageIcon className="w-6 h-6 text-pink-400" />,
  other: <File className="w-6 h-6 text-gray-400" />,
};

export default function DocumentsPage() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { data: documents, mutate, isLoading } = useSWR("/api/documents", fetcher);
  const { data: projects } = useSWR("/api/projects", fetcher);
  const [projectFilter, setProjectFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({ type:"other" });
  const [file, setFile] = useState<File|null>(null);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const canManage = ["admin","manager"].includes(session?.user?.role||"");
  const list: any[] = Array.isArray(documents) ? documents : [];
  const filtered = list.filter((d:any)=>(!projectFilter||d.projectId===projectFilter)&&(!typeFilter||d.type===typeFilter));

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!form.name) return;
    setLoading(true);
    try {
      let fileUrl = form.fileUrl || null;
      let fileType = file?.type || null;
      let fileSize = file?.size || null;

      if (file) {
        // Get signature from server (fast — no file data sent)
        const signRes = await fetch("/api/upload");
        if (!signRes.ok) { toast({ title: "Error", description: "Could not get upload token", variant: "destructive" }); return; }
        const { signature, timestamp, apiKey, cloudName, folder } = await signRes.json();

        // Upload directly from browser to Cloudinary (bypasses Netlify timeout)
        const fd = new FormData();
        fd.append("file", file);
        fd.append("api_key", apiKey);
        fd.append("timestamp", timestamp);
        fd.append("folder", folder);
        fd.append("signature", signature);

        const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: fd });
        if (!uploadRes.ok) { toast({ title: "Error", description: "File upload to Cloudinary failed", variant: "destructive" }); return; }
        const json = await uploadRes.json();
        fileUrl = json.secure_url || null;
        fileSize = json.bytes || fileSize;
      }

      const res = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, fileUrl, fileType, fileSize }) });
      if (!res.ok) { const e = await res.json(); toast({ title: "Error", description: e.error || "Failed to save document", variant: "destructive" }); return; }
      mutate(); setShowForm(false); setForm({ type: "other" }); setFile(null);
    } finally { setLoading(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document?")) return;
    const res = await fetch(`/api/documents/${id}`,{method:"DELETE"});
    if (!res.ok) { const e = await res.json().catch(()=>({})); toast({ title: "Error", description: e.error || "Failed to delete document", variant: "destructive" }); return; }
    mutate();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500">{filtered.length} documents</p>
        </div>
        {canManage && <button onClick={()=>setShowForm(!showForm)} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors shrink-0">+ Upload Document</button>}
      </div>

      <div className="flex gap-3 flex-wrap">
        <select value={projectFilter} onChange={e=>setProjectFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Projects</option>
          {(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-full sm:w-auto focus:outline-none focus:ring-2 focus:ring-blue-500/40">
          <option value="">All Types</option>
          {Object.keys(TYPE_ICONS).map(t=><option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 space-y-4 shadow-sm">
          <h2 className="font-semibold">Upload Document</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input required value={form.name||""} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Document Name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <select value={form.type||"other"} onChange={e=>setForm({...form,type:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              {Object.keys(TYPE_ICONS).map(t=><option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.projectId||""} onChange={e=>setForm({...form,projectId:e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40">
              <option value="">Select Project (opt)</option>
              {(projects||[]).map((p:any)=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input value={form.fileUrl||""} onChange={e=>setForm({...form,fileUrl:e.target.value})} placeholder="External URL (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <textarea value={form.description||""} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Description" rows={2} className="border border-gray-200 rounded-lg px-3 py-2 text-sm sm:col-span-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            <div className="sm:col-span-2">
              <label className="block text-sm text-gray-600 mb-1">Upload File (max 50MB)</label>
              <input ref={fileRef} type="file" onChange={e=>setFile(e.target.files?.[0]||null)} className="block w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50 hover:bg-blue-700 transition-colors">{loading?"Uploading...":"Upload Document"}</button>
            <button type="button" onClick={()=>setShowForm(false)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
          </div>
        </form>
      )}

      {isLoading ? (
        <CardGridSkeleton />
      ) : filtered.length===0 ? (
        <div className="bg-white border border-gray-200 rounded-xl">
          <EmptyState icon={<FolderOpen className="w-10 h-10" />} title="No documents yet" hint="Upload drawings, reports, permits, or photos related to your projects." />
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((d:any)=>(
          <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <span>{TYPE_ICONS[d.type] || <File className="w-6 h-6 text-gray-400" />}</span>
              <div className="flex gap-2">
                {d.fileUrl && <a href={d.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">Download</a>}
                {canManage && <button onClick={()=>handleDelete(d.id)} className="text-xs text-red-400 hover:text-red-600">Delete</button>}
              </div>
            </div>
            <h3 className="font-medium text-gray-900 text-sm line-clamp-2">{d.name}</h3>
            <p className="text-xs text-gray-500 mt-1 capitalize">{d.type}</p>
            {d.project && <p className="text-xs text-blue-600 mt-1">{d.project.name}</p>}
            {d.description && <p className="text-xs text-gray-400 mt-2 line-clamp-2">{d.description}</p>}
            <p className="text-xs text-gray-300 mt-2 whitespace-nowrap">{new Date(d.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
