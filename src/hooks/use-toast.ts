"use client"
import { showToast } from "@/components/ui/toast"
import type { ToastActionElement, ToastProps } from "@/components/ui/toast"

type ToastOptions = ToastProps & {
  title?: string
  description?: string
  action?: ToastActionElement
  variant?: "default" | "destructive"
}

function toast({ title, description, variant }: ToastOptions) {
  const msg = [title, description].filter(Boolean).join(": ") || "Notification"
  showToast(msg, variant === "destructive" ? "error" : "success")
}

function useToast() {
  return { toast, toasts: [] as ToastOptions[], dismiss: (_id?: string) => {} }
}

export { useToast, toast }
