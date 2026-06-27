// Convenience wrappers around the existing shadcn toast system
import { toast } from "@/hooks/use-toast";

export function showSuccess(message: string) {
  toast({ title: "Success", description: message });
}

export function showError(message: string) {
  toast({ title: "Error", description: message, variant: "destructive" });
}

export function showInfo(message: string) {
  toast({ title: message });
}
