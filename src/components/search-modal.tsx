"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const TYPE_COLORS: Record<string, string> = {
  Project: "bg-blue-100 text-blue-700",
  Client: "bg-purple-100 text-purple-700",
  Vendor: "bg-orange-100 text-orange-700",
  Employee: "bg-green-100 text-green-700",
  Task: "bg-yellow-100 text-yellow-700",
  Contract: "bg-red-100 text-red-700",
};

interface Result { type: string; id: string; name: string; detail: string; href: string; }

export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (open) { setQuery(""); setResults([]); setSelected(0); setTimeout(() => inputRef.current?.focus(), 50); }
  }, [open]);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setSelected(0);
      } finally { setLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const go = useCallback((href: string) => { router.push(href); onClose(); }, [router, onClose]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && results[selected]) go(results[selected].href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, selected, go, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search projects, clients, vendors, employees…" className="flex-1 outline-none text-sm text-gray-900 placeholder-gray-400 bg-transparent" />
          <kbd className="hidden sm:inline-flex px-2 py-0.5 text-xs text-gray-400 border border-gray-200 rounded">Esc</kbd>
        </div>
        {loading && <div className="px-4 py-8 text-center text-sm text-gray-400">Searching…</div>}
        {!loading && query.length >= 2 && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">No results found for &ldquo;{query}&rdquo;</div>
        )}
        {!loading && results.length > 0 && (
          <ul className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {results.map((r, i) => (
              <li key={r.type + r.id}>
                <button onClick={() => go(r.href)} className={"w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors " + (i === selected ? "bg-blue-50" : "")}>
                  <span className={"text-xs px-2 py-0.5 rounded-full font-medium shrink-0 " + (TYPE_COLORS[r.type] || "bg-gray-100 text-gray-600")}>{r.type}</span>
                  <span className="text-sm font-medium text-gray-900 flex-1 truncate">{r.name}</span>
                  {r.detail && <span className="text-xs text-gray-400 capitalize shrink-0">{r.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {!query && (
          <div className="px-4 py-6 text-center text-sm text-gray-400">Type at least 2 characters to search</div>
        )}
      </div>
    </div>
  );
}
