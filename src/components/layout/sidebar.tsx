"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
type Role = "admin" | "ceo" | "manager" | "accountant";
import {
  Building2, LayoutDashboard, FolderOpen, Users, FileText,
  Package, Wrench, UserCheck, DollarSign, Receipt, FileStack,
  Bell, Bot, Settings, TruckIcon, ClipboardList, BarChart3,
  CreditCard, ChevronDown, ChevronRight, CalendarCheck, Search, X,
} from "lucide-react";
import { useState, useEffect } from "react";
import { SearchModal } from "@/components/search-modal";

type NavItem = {
  label: string;
  href?: string;
  icon: React.ElementType;
  roles: Role[];
  children?: { label: string; href: string }[];
};

const NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "ceo", "manager", "accountant"] },
  { label: "Projects", href: "/projects", icon: FolderOpen, roles: ["admin", "ceo", "manager"] },
  { label: "Contracts", href: "/contracts", icon: FileText, roles: ["admin", "ceo", "manager"] },
  { label: "Clients", href: "/clients", icon: Users, roles: ["admin", "ceo", "manager", "accountant"] },
  { label: "Vendors", href: "/vendors", icon: TruckIcon, roles: ["admin", "ceo", "manager", "accountant"] },
  { label: "Tasks", href: "/tasks", icon: ClipboardList, roles: ["admin", "ceo", "manager"] },
  { label: "Materials", href: "/materials", icon: Package, roles: ["admin", "ceo", "manager"] },
  { label: "Equipment", href: "/equipment", icon: Wrench, roles: ["admin", "ceo", "manager"] },
  { label: "Employees", href: "/employees", icon: UserCheck, roles: ["admin", "ceo", "manager"] },
  { label: "Attendance", href: "/attendance", icon: CalendarCheck, roles: ["admin", "ceo", "manager"] },
  {
    label: "Finance", icon: DollarSign, roles: ["admin", "ceo", "accountant"],
    children: [
      { label: "Ledger", href: "/finance/ledger" },
      { label: "Accounts", href: "/finance/accounts" },
      { label: "Payments", href: "/finance/payments" },
      { label: "Profit Sheets", href: "/finance/profit-sheets" },
    ],
  },
  { label: "Billing", href: "/billing", icon: Receipt, roles: ["admin", "ceo", "accountant"] },
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
    <aside
      className={cn(
        "w-64 bg-sidebar flex flex-col shadow-xl z-40 transition-transform duration-200",
        "fixed inset-y-0 left-0 lg:static lg:translate-x-0",
        mobileOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-sidebar-foreground leading-tight">Construction ERP</p>
          <p className="text-xs text-sidebar-foreground/50 leading-tight">LA Tech Solutions</p>
        </div>
        <button onClick={onClose} className="ml-auto lg:hidden text-sidebar-foreground/60 hover:text-sidebar-foreground" aria-label="Close menu">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-sidebar-border">
        <button onClick={() => setSearchOpen(true)} className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground/50 bg-sidebar-accent/30 hover:bg-sidebar-accent/60 transition-colors">
          <Search className="w-3.5 h-3.5" />
          <span>Search…</span>
          <kbd className="ml-auto text-sidebar-foreground/30 border border-sidebar-border rounded px-1">⌘K</kbd>
        </button>
      </div>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
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
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
                {isOpen && (
                  <div className="ml-7 mt-0.5 space-y-0.5">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onClose}
                        className={cn(
                          "block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                          pathname === child.href
                            ? "bg-sidebar-primary text-sidebar-primary-foreground"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
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

          return (
            <Link
              key={item.href}
              href={item.href!}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                pathname === item.href || pathname.startsWith(item.href! + "/")
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="w-4 h-4 flex-shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Role Badge */}
      <div className="px-6 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-sidebar-foreground/40" />
          <span className="text-xs text-sidebar-foreground/40">Role: {role}</span>
        </div>
      </div>
    </aside>
  );
}
