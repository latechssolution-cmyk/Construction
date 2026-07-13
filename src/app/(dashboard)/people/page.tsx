"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Building2, TruckIcon, UserCheck, Wallet, CalendarCheck, HandCoins } from "lucide-react";
import { cn } from "@/lib/utils";
import ClientsPage from "@/app/(dashboard)/clients/page";
import VendorsPage from "@/app/(dashboard)/vendors/page";
import EmployeesPage from "@/app/(dashboard)/employees/page";
import AttendancePage from "@/app/(dashboard)/attendance/page";
import PartnersPage from "@/app/(dashboard)/partners/page";
import { SalaryHistory } from "@/components/people/salary-history";

type TabKey = "clients" | "vendors" | "employees" | "partners" | "attendance" | "salary";

const TABS: { key: TabKey; label: string; icon: React.ElementType; roles?: string[] }[] = [
  { key: "clients", label: "Clients", icon: Building2 },
  { key: "vendors", label: "Vendors", icon: TruckIcon },
  { key: "employees", label: "Employees", icon: UserCheck },
  { key: "partners", label: "Partners", icon: HandCoins, roles: ["admin", "ceo", "accountant"] },
  { key: "attendance", label: "Attendance", icon: CalendarCheck, roles: ["admin", "ceo", "manager"] },
  { key: "salary", label: "Salary History", icon: Wallet, roles: ["admin", "ceo", "accountant"] },
];

function PeopleContent() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as TabKey) || "clients";
  const [tab, setTab] = useState<TabKey>(TABS.some((t) => t.key === initialTab) ? initialTab : "clients");

  const role = session?.user?.role || "";
  const canSeeSalary = ["admin", "ceo", "accountant"].includes(role);
  const visibleTabs = TABS.filter((t) => !t.roles || t.roles.includes(role));

  function selectTab(key: TabKey) {
    setTab(key);
    router.replace(`/people?tab=${key}`, { scroll: false });
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 sm:px-6 pt-4 sm:pt-6">
        <h1 className="text-2xl font-bold text-gray-900">People</h1>
        <p className="text-sm text-gray-500 mb-4">Clients, vendors, employees, and payroll — all in one place.</p>
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              onClick={() => selectTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors",
                tab === t.key
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {tab === "clients" && <ClientsPage />}
        {tab === "vendors" && <VendorsPage />}
        {tab === "employees" && <EmployeesPage />}
        {tab === "partners" && ["admin", "ceo", "accountant"].includes(role) && <PartnersPage />}
        {tab === "attendance" && ["admin", "ceo", "manager"].includes(role) && <AttendancePage />}
        {tab === "salary" && canSeeSalary && (
          <div className="p-4 sm:p-6">
            <SalaryHistory />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-400">Loading…</div>}>
      <PeopleContent />
    </Suspense>
  );
}
