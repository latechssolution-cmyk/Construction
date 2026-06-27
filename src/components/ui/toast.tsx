"use client";
import React, { useEffect, useState } from "react";
import { X, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

// Type stubs used by use-toast.ts / toaster.tsx
export type ToastProps = { variant?: "default" | "destructive"; open?: boolean; onOpenChange?: (open: boolean) => void };
export type ToastActionElement = React.ReactElement;

export type ToastType = "success" | "error" | "info" | "warning";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

// Global event emitter for toasts
const listeners: ((t: Toast) => void)[] = [];
export function showToast(message: string, type: ToastType = "info") {
  const toast: Toast = { id: Math.random().toString(36).slice(2), message, type };
  listeners.forEach(fn => fn(toast));
}

const ICONS: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4" />,
  error: <XCircle className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
};
const COLORS: Record<ToastType, string> = {
  success: "bg-green-600",
  error: "bg-red-600",
  warning: "bg-yellow-500",
  info: "bg-blue-600",
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const handler = (t: Toast) => {
      setToasts(prev => [...prev, t]);
      setTimeout(() => setToasts(prev => prev.filter(x => x.id !== t.id)), 4000);
    };
    listeners.push(handler);
    return () => { const i = listeners.indexOf(handler); if (i > -1) listeners.splice(i, 1); };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium min-w-64 max-w-sm pointer-events-auto animate-fade-in ${COLORS[t.type]}`}>
          <span className="text-base font-bold">{ICONS[t.type]}</span>
          <span>{t.message}</span>
          <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="ml-auto opacity-70 hover:opacity-100"><X className="w-4 h-4" /></button>
        </div>
      ))}
    </div>
  );
}
