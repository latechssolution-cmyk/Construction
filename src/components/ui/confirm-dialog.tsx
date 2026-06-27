"use client";
import { useState } from "react";

interface Props {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmClass?: string;
  onConfirm: () => void | Promise<void>;
  children: (open: () => void) => React.ReactNode;
}

export function ConfirmDialog({ title, message, confirmLabel = "Confirm", confirmClass = "bg-red-600 hover:bg-red-700 text-white", onConfirm, children }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    setLoading(true);
    try { await onConfirm(); } finally { setLoading(false); setOpen(false); }
  }

  return (
    <>
      {children(() => setOpen(true))}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-500 mb-6">{message}</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setOpen(false)} disabled={loading} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleConfirm} disabled={loading} className={`px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-50 ${confirmClass}`}>
                {loading ? "Please wait…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
