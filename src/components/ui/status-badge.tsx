import { getStatusColor } from "@/lib/utils";

// Single source of truth for status pill styling across the app (ledger,
// invoices, projects, contracts, equipment, subcontracts, etc. all shared
// slightly different ad-hoc color maps before this — this reuses the
// existing getStatusColor() map from lib/utils so no color mapping moves).
export function StatusBadge({ status, className = "" }: { status?: string | null; className?: string }) {
  if (!status) return null;
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize whitespace-nowrap ${getStatusColor(status)} ${className}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
