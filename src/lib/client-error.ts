// Friendly client-side error messages for common API error patterns
export function friendlyError(err: unknown): string {
  if (!err) return "An unexpected error occurred. Please try again.";
  const msg = typeof err === "string" ? err : (err as { error?: string; message?: string })?.error || (err as Error)?.message || "";
  if (!msg) return "An unexpected error occurred. Please try again.";
  if (msg.toLowerCase().includes("already exists")) return "A record with this information already exists.";
  if (msg.toLowerCase().includes("not found")) return "The record was not found. It may have been deleted.";
  if (msg.toLowerCase().includes("unauthorized") || msg.toLowerCase().includes("unauthenticated")) return "Your session has expired. Please sign in again.";
  if (msg.toLowerCase().includes("forbidden") || msg.toLowerCase().includes("permission")) return "You do not have permission to perform this action.";
  if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) return "Connection problem. Please check your internet and try again.";
  return msg;
}

export async function apiFetch(url: string, options?: RequestInit): Promise<{ data?: unknown; error?: string }> {
  try {
    const res = await fetch(url, options);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return { error: friendlyError(json) };
    return { data: json };
  } catch {
    return { error: "Connection problem. Please check your internet and try again." };
  }
}
