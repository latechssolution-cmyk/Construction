"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LABELS: Record<string, string> = {
  "": "Home",
  projects: "Projects",
  clients: "Clients",
  vendors: "Vendors",
  employees: "Employees",
  tasks: "Tasks",
  contracts: "Contracts",
  materials: "Materials",
  equipment: "Equipment",
  documents: "Documents",
  attendance: "Attendance",
  billing: "Billing",
  payments: "Payments",
  finance: "Finance",
  ledger: "Ledger",
  "bank-accounts": "Bank Accounts",
  "profit-sheets": "Profit Sheets",
  "ai-chat": "AI Assistant",
  settings: "Settings",
  dashboard: "Dashboard",
};

function label(seg: string) {
  return LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1);
}

export function Breadcrumb({ recordName }: { recordName?: string }) {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length <= 1) return null; // don't show on top-level pages

  const crumbs: { name: string; href: string }[] = [{ name: "Home", href: "/dashboard" }];
  let path = "";
  segments.forEach((seg, i) => {
    path += "/" + seg;
    const isLast = i === segments.length - 1;
    // If it looks like a UUID (record ID), use the recordName if available
    const isId = /^[0-9a-f-]{20,}$/i.test(seg);
    if (isId) {
      crumbs.push({ name: recordName || "Detail", href: path });
    } else {
      crumbs.push({ name: label(seg), href: path });
    }
  });

  return (
    <nav className="flex items-center gap-1 text-xs text-gray-400 mb-4">
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <span key={c.href} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">/</span>}
            {isLast ? (
              <span className="text-gray-600 font-medium">{c.name}</span>
            ) : (
              <Link href={c.href} className="hover:text-blue-600 transition-colors">{c.name}</Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
