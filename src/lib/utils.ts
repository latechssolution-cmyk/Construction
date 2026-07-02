import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return "PKR 0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  // Guard against NaN — e.g. parseFloat('abc') returns NaN (Issue #100)
  if (isNaN(num)) return "PKR 0";
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date);
  if (isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * @deprecated Use generateSequentialBillNumber() from the API layer (Counter model) instead.
 * This sync version remains for backwards compatibility with any callers that cannot be async.
 * The API routes use the async Counter-based version which is collision-free.
 */
export function generateBillNumber(): string {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  // Fallback: timestamp-based suffix is far less likely to collide than 4-digit random
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

/**
 * @deprecated Use generateSequentialContractNumber() from the API layer (Counter model) instead.
 */
export function generateContractNumber(): string {
  const now = new Date();
  const prefix = `CNT-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return `${prefix}-${Date.now().toString().slice(-6)}`;
}

export function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    admin: "bg-red-100 text-red-800",
    ceo: "bg-purple-100 text-purple-800",
    manager: "bg-blue-100 text-blue-800",
    accountant: "bg-green-100 text-green-800",
  };
  return colors[role?.toLowerCase()] || "bg-gray-100 text-gray-800";
}

export function getProjectProgress(tasks: Array<{ status: string }>): number {
  if (!tasks || tasks.length === 0) return 0;
  const completed = tasks.filter((t) => t.status === "completed").length;
  return Math.round((completed / tasks.length) * 100);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    planning: "bg-yellow-100 text-yellow-800",
    in_progress: "bg-blue-100 text-blue-800",
    on_hold: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800",
    active: "bg-green-100 text-green-800",
    terminated: "bg-red-100 text-red-800",
    draft: "bg-gray-100 text-gray-800",
    issued: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    partially_paid: "bg-yellow-100 text-yellow-800",
    overdue: "bg-red-100 text-red-800",
    pending: "bg-gray-100 text-gray-800",
    available: "bg-green-100 text-green-800",
    in_use: "bg-blue-100 text-blue-800",
    maintenance: "bg-orange-100 text-orange-800",
    decommissioned: "bg-gray-100 text-gray-500",
  };
  return colors[status?.toLowerCase()] || "bg-gray-100 text-gray-800";
}
