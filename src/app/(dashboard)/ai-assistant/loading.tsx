import React from "react";


export default function Loading() {
  return (
    <div className="flex flex-col h-full bg-gray-50 p-6 items-center justify-center">
      <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse mb-4" />
      <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
    </div>
  );
}
