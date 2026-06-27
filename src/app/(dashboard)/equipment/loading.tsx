import React from "react";
import { CardGridSkeleton, StatsSkeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
      <CardGridSkeleton count={6} />
    </div>
  );
}
