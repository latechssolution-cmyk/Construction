"use client";

import { signOut } from "next-auth/react";
import { Bell, LogOut, User, ChevronDown, X, ExternalLink, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getRoleBadgeColor } from "@/lib/utils";
type Role = "admin" | "ceo" | "manager" | "accountant";
import useSWR from "swr";
import { useState } from "react";
import { useRouter } from "next/navigation";

const fetcher = (url: string) => fetch(url).then(r => r.json());

const TYPE_BG: Record<string, string> = {
  overdue_task: "bg-yellow-50 border-yellow-100",
  overdue_invoice: "bg-red-50 border-red-100",
  low_stock: "bg-orange-50 border-orange-100",
  upcoming_milestone: "bg-blue-50 border-blue-100",
};

interface HeaderProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    role: string;
  };
  onMenuClick?: () => void;
}

export function Header({ user, onMenuClick }: HeaderProps) {
  const router = useRouter();
  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.[0].toUpperCase() ?? "U";

  const [showNotifs, setShowNotifs] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const { data: notifData } = useSWR("/api/notifications", fetcher, { refreshInterval: 300000, dedupingInterval: 60000, revalidateOnFocus: false });
  const allNotifs: any[] = (notifData?.notifications || []).filter((n: any) => !dismissed.has(n.id));
  const count = allNotifs.length;

  function dismiss(id: string) { setDismissed(prev => new Set([...prev, id])); }
  function dismissAll() { setDismissed(new Set(allNotifs.map((n: any) => n.id))); }

  function goTo(href: string) { router.push(href); setShowNotifs(false); }

  return (
    <header className="h-16 bg-white border-b flex items-center justify-between px-4 sm:px-6 flex-shrink-0 shadow-sm">
      <div className="flex items-center gap-3 min-w-0">
        <button onClick={onMenuClick} className="lg:hidden text-gray-600 hover:text-gray-900 -ml-1" aria-label="Open menu">
          <Menu className="w-6 h-6" />
        </button>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-gray-800 truncate">Construction ERP Portal</h2>
          <p className="text-xs text-gray-400 hidden sm:block">LA Tech Solutions</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <Button variant="ghost" size="icon" className="relative" onClick={() => setShowNotifs(!showNotifs)}>
            <Bell className="w-4 h-4" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                {count > 99 ? "99+" : count}
              </span>
            )}
          </Button>

          {showNotifs && (
            <div className="absolute right-0 top-11 w-80 sm:w-96 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-gray-900">Alerts</h3>
                  {count > 0 && <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{count} active</span>}
                </div>
                <div className="flex items-center gap-2">
                  {count > 0 && <button onClick={dismissAll} className="text-xs text-blue-600 hover:underline">Dismiss all</button>}
                  <button onClick={() => setShowNotifs(false)} className="text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
                {allNotifs.length === 0 ? (
                  <div className="py-10 text-center">
                    <p className="text-2xl mb-2">&#x2705;</p>
                    <p className="text-sm text-gray-500 font-medium">All clear!</p>
                    <p className="text-xs text-gray-400 mt-1">No active alerts right now.</p>
                  </div>
                ) : (
                  allNotifs.map((n: any) => (
                    <div key={n.id} className={"px-4 py-3 flex items-start gap-3 hover:bg-gray-50 transition-colors " + (TYPE_BG[n.type] || "")}>
                      <span className="text-lg leading-none mt-0.5 shrink-0">{n.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-900">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{n.body}</p>
                        {n.date && <p className="text-xs text-gray-400 mt-1">Due: {new Date(n.date).toLocaleDateString()}</p>}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <button onClick={() => goTo(n.href)} className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">View<ExternalLink className="w-2.5 h-2.5" /></button>
                        <button onClick={() => dismiss(n.id)} className="text-xs text-gray-400 hover:text-gray-600">Dismiss</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 h-auto py-1 px-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={user.image ?? undefined} />
                <AvatarFallback className="text-xs bg-blue-100 text-blue-700">{initials}</AvatarFallback>
              </Avatar>
              <div className="text-left hidden sm:block">
                <p className="text-sm font-medium leading-tight">{user.name ?? "User"}</p>
                <span className={"text-xs px-1.5 py-0.5 rounded font-medium " + getRoleBadgeColor(user.role)}>{user.role}</span>
              </div>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <p className="font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground font-normal">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")} className="cursor-pointer"><User className="w-4 h-4 mr-2" />Profile</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="w-4 h-4 mr-2" />Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
