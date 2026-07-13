import Link from "next/link";
import { cn } from "@/lib/utils";

type StatCardTone = "blue" | "green" | "red" | "purple" | "orange" | "gray";

const TONE_ICON: Record<StatCardTone, string> = {
  blue: "bg-blue-50 text-blue-600",
  green: "bg-green-50 text-green-600",
  red: "bg-red-50 text-red-600",
  purple: "bg-purple-50 text-purple-600",
  orange: "bg-orange-50 text-orange-600",
  gray: "bg-gray-100 text-gray-500",
};

const TONE_VALUE: Record<StatCardTone, string> = {
  blue: "text-blue-700",
  green: "text-green-700",
  red: "text-red-700",
  purple: "text-purple-700",
  orange: "text-orange-700",
  gray: "text-gray-900",
};

// Neutral-card + accent-icon KPI card — replaces the older full-color-tint
// stat card pattern (bg-blue-50 border-blue-200 fill) used across the
// dashboard and module summary rows. Same data/props shape, just a cleaner
// surface so a screen full of KPIs doesn't turn into a wall of color.
export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "blue",
  urgent = false,
  className,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  tone?: StatCardTone;
  urgent?: boolean;
  className?: string;
  href?: string;
}) {
  // Long PKR figures ("PKR 393,350,000") have no natural break point inside
  // the number itself — break-words/overflow-wrap will force a break
  // mid-digit ("393,350," / "000") once the card gets narrow (5-col grids).
  // break-normal only wraps at the space after "PKR", keeping the number
  // intact; a smaller font for long values keeps that single line fitting
  // inside typical card widths instead of overflowing.
  const valueStr = String(value);
  const isLongValue = valueStr.length > 12;

  const body = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate" title={label}>{label}</p>
        <p
          className={cn(
            "font-bold mt-1 break-normal",
            isLongValue ? "text-base sm:text-lg lg:text-xl" : "text-lg sm:text-xl lg:text-2xl",
            TONE_VALUE[tone]
          )}
          title={valueStr}
        >
          {value}
        </p>
        {sub && <p className="text-xs text-gray-400 mt-1 truncate" title={sub}>{sub}</p>}
      </div>
      {icon && (
        <div className={cn("shrink-0 w-9 h-9 rounded-lg flex items-center justify-center", TONE_ICON[tone])}>
          {icon}
        </div>
      )}
    </div>
  );

  const cardClassName = cn(
    "bg-white border border-gray-200 rounded-xl p-4 sm:p-5 shadow-sm transition-shadow hover:shadow-md",
    urgent && "ring-1 ring-red-300 border-red-200",
    href && "hover:border-blue-300 cursor-pointer",
    className
  );

  if (href) {
    return (
      <Link href={href} className={cardClassName}>
        {body}
      </Link>
    );
  }

  return <div className={cardClassName}>{body}</div>;
}
