import React from "react";

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 px-4">
      {icon && (
        <div className="flex justify-center mb-3 text-gray-300">
          {icon}
        </div>
      )}
      <p className="font-medium text-gray-700">{title}</p>
      {hint && <p className="text-sm mt-1 text-gray-400 max-w-md mx-auto">{hint}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
