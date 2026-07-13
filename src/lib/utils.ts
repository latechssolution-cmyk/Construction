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

export function generateBillNumber(): string {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

export function getProjectProgress(tasks: Array<{ status: string; weight?: number }>): number {
  if (!tasks || tasks.length === 0) return 0;
  const totalWeight = tasks.reduce((sum, t) => sum + (t.weight || 1), 0);
  const completedWeight = tasks.filter((t) => t.status === "completed").reduce((sum, t) => sum + (t.weight || 1), 0);
  return totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    planning: "bg-yellow-100 text-yellow-800",
    // Project statuses (client taxonomy)
    ongoing: "bg-blue-100 text-blue-800",
    physically_closed: "bg-teal-100 text-teal-800",
    financially_closed: "bg-green-100 text-green-800",
    sick: "bg-red-100 text-red-800",
    // Task/other statuses (kept — Task uses todo/in_progress/on_hold/completed)
    in_progress: "bg-blue-100 text-blue-800",
    on_hold: "bg-orange-100 text-orange-800",
    completed: "bg-green-100 text-green-800",
    cancelled: "bg-gray-200 text-gray-600",
    active: "bg-green-100 text-green-800",
    terminated: "bg-red-100 text-red-800",
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800",
    pending: "bg-gray-100 text-gray-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    // Loan statuses
    partially_repaid: "bg-yellow-100 text-yellow-800",
    repaid: "bg-green-100 text-green-800",
    written_off: "bg-red-100 text-red-800",
    available: "bg-green-100 text-green-800",
    in_use: "bg-blue-100 text-blue-800",
    maintenance: "bg-orange-100 text-orange-800",
    decommissioned: "bg-gray-100 text-gray-500",
  };
  return colors[status?.toLowerCase()] || "bg-gray-100 text-gray-800";
}
