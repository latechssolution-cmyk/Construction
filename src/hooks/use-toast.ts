"use client"
import { useState, useEffect } from "react"
import { showToast } from "@/components/ui/toast"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

type ToastOptions = ToastProps & {
  id?: string
  title?: string
  description?: string
  action?: ToastActionElement
  variant?: "default" | "destructive"
}

let listeners: Array<(toasts: ToastOptions[]) => void> = [];
let memoryToasts: ToastOptions[] = [];

export function toast(options: ToastOptions) {
  const id = options.id || Math.random().toString(36).slice(2);
  const newToast = { ...options, id };
  
  const msg = [options.title, options.description].filter(Boolean).join(": ") || "Notification";
  showToast(msg, options.variant === "destructive" ? "error" : "success");

  memoryToasts = [...memoryToasts, newToast];
  listeners.forEach((l) => l(memoryToasts));

  setTimeout(() => {
    dismiss(id);
  }, 4000);

  return {
    id,
    dismiss: () => dismiss(id),
  };
}

function dismiss(id?: string) {
  if (id === undefined) {
    memoryToasts = [];
  } else {
    memoryToasts = memoryToasts.filter((t) => t.id !== id);
  }
  listeners.forEach((l) => l(memoryToasts));
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastOptions[]>(memoryToasts);

  useEffect(() => {
    const listener = (newToasts: ToastOptions[]) => setToasts(newToasts);
    listeners.push(listener);
    return () => {
      listeners = listeners.filter((l) => l !== listener);
    };
  }, []);

  return {
    toast,
    toasts,
    dismiss,
  };
}
