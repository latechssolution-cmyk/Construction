"use client";
import { SWRConfig } from "swr";

import { toast } from "@/hooks/use-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig 
      value={{ 
        revalidateOnFocus: false, 
        dedupingInterval: 1000,
        onError: (err) => {
          toast({ 
            title: "Data Fetch Error", 
            description: err.message || "Failed to load data from the server.", 
            variant: "destructive" 
          });
        }
      }}
    >
      {children}
    </SWRConfig>
  );
}
