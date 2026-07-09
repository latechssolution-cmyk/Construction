"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
type Role = "admin" | "ceo" | "manager" | "accountant";
import {
  Building2, LayoutDashboard, FolderOpen, Users,
  Wrench, DollarSign, FileStack,
  Bot, Settings,
  ChevronDown, ChevronRight, Search, X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { SearchModal } from "@/components/search-modal";
import { getRoleBadgeColor } from "@/lib/utils";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  roles: Role[];
  children?: { label: string; href: string }[];
};

// Everything that's created/edited "about one project" now lives inside that
// project's own workspace (/projects/[id] tabs: Materials, Finance ledger,
// Invoices, Contract, Tasks, Team). Everything that's created/edited "about
// one person or company" lives in /people (Clients, Vendors, Employees,
// Attendance, Salary History). That leaves 8 top-level destinations instead
// of the original 15 — the rest are reachable from inside a project or
// person record, not duplicated as separate nav items. Old standalone routes
// (/materials, /tasks, /contracts, /billing, /attendance, /clients,
// /vendors, /employees) still resolve for deep links; they're just not in
// the sidebar anymore.
const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "ceo", "manager", "accountant"] },
  { label: "Projects", href: "/projects", icon: FolderOpen, roles: ["admin", "ceo", "manager"] },
  { label: "People", href: "/people", icon: Users, roles: ["admin", "ceo", "manager", "accountant"] },
  { label: "Equipment", href: "/equipment", icon: Wrench, roles: ["admin", "ceo", "manager"] },
  {
    label: "Finance", icon: DollarSign, roles: ["admin", "ceo", "accountant"],
    children: [
      { label: "Ledger", href: "/finance/ledger" },
      { label: "Accounts", href: "/finance/accounts" },
      { label: "Payments", href: "/finance/payments" },
      { label: "Profit Sheets", href: "/finance/profit-sheets" },
    ],
  },
  { label: "Documents", href: "/documents", icon: FileStack, roles: ["admin", "ceo", "manager", "accountant"] },
  { label: "AI Assistant", href: "/ai-assistant", icon: Bot, roles: ["admin", "ceo", "manager"] },
  { label: "Users", href: "/admin/users", icon: Settings, roles: ["admin", "ceo"] },
];

export function Sidebar({ role, mobileOpen = false, onClose }: { role: Role; mobileOpen?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const [openGroups, setOpenGroups] = useState<string[]>(["Finance"]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setSearchOpen(true); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredNav = NAV.filter((item) => item.roles.includes(role));

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((g) => g !== label) : [...prev, label]
    );
  };

  return (
    <>
    <aside
      className={cn(
        "w-64 bg-sidebar flex flex-col shadow-xl z-40 transition-transform duration-200",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-700 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm shadow-blue-900/30">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground leading-tight truncate">Construction ERP</p>
          <p className="text-xs text-sidebar-foreground/50 leading-tight truncate">LA Tech Solutions</p>
        </div>
        <button onClick={onClose} className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground" aria-label="Close menu">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-2">
        <button onClick={() => setSearchOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/50 bg-sidebar-accent/40 hover:bg-sidebar-accent/70 transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Search…</span>
          <kbd className="ml-auto text-sidebar-foreground/30 border border-sidebar-border rounded px-1.5 py-0.5 text-[10px]">⌘K</kbd>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5">
        {filteredNav.map((item) => {
          if (item.children) {
            const isOpen = openGroups.includes(item.label);
            const isActive = item.children.some((c) => pathname.startsWith(c.href));
            return (
              <div key={item.label}>
                <button
                  onClick={() => toggleGroup(item.label)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-foreground"
                      : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-blue-400" : "text-sidebar-foreground/50")} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen ? <ChevronDown className="w-3 h-3 opacity-60" /> : <ChevronRight className="w-3 h-3 opacity-60" />}
                </button>
                {isOpen && (
                  <div className="ml-4 mt-0.5 pl-3.5 border-l border-sidebar-border space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        className={cn(
                          "block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          pathname === child.href
                            ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                            : "text-sidebar-foreground/55 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          const isActive = pathname === item.href || pathname.startsWith(item.href! + "/");
          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={onClose}
              className={cn(
                "relative flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className={cn("w-4 h-4 flex-shrink-0", !isActive && "text-sidebar-foreground/50")} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Role Badge */}
      <div className="px-4 py-3.5 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold uppercase shrink-0", getRoleBadgeColor(role))}>
            {role[0]}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-sidebar-foreground/70 capitalize truncate">{role}</p>
            <p className="text-[10px] text-sidebar-foreground/35 leading-tight">Signed in</p>
          </div>
        </div>
      </div>
    </aside>
    <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
