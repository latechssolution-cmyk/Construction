"use client";
import { useState } from "react";
import { Download } from "lucide-react";

interface Props {
  module: "invoices" | "ledger" | "attendance" | "materials" | "payments";
  label?: string;
}

export function ExportButton({ module, label = "Export CSV" }: Props) {
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch(`/api/export?module=${module}`);
      if (!res.ok) { const e = await res.json(); alert(e.error || "Export failed"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const cd = res.headers.get("content-disposition") || "";
      const fname = cd.match(/filename="(.+?)"/)?.[1] || `${module}.csv`;
      a.href = url; a.download = fname; a.click();
      URL.revokeObjectURL(url);
    } finally { setLoading(false); }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
      title="Export to CSV (opens in Excel)"
    >
      <Download className="w-4 h-4" />
      {loading ? "Generating…" : label}
    </button>
  );
}
