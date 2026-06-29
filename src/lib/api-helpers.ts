import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export interface AuthSession {
  user: { id: string; role: string; name?: string | null; email?: string | null };
}

export async function requireAuth(): Promise<AuthSession> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new ApiError(401, "Unauthorized");
  }
  return session as AuthSession;
}

export function requireRole(session: AuthSession, ...roles: string[]): void {
  if (!roles.includes(session.user.role)) {
    throw new ApiError(403, "Forbidden: insufficient permissions");
  }
}

export class ApiError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

function friendlyMongoError(error: unknown): string | null {
  if (typeof error !== "object" || !error) return null;
  const e = error as Record<string, unknown>;
  // Duplicate key error
  if (e.code === 11000) return "A record with this information already exists.";
  // Cast error
  if (e.name === "CastError") return "Invalid ID format.";
  // Validation error
  if (e.name === "ValidationError") {
    const ve = e as { errors?: Record<string, { message: string }> };
    const msgs = ve.errors ? Object.values(ve.errors).map((err) => err.message) : [];
    return msgs.length ? msgs.join(", ") : "Validation failed.";
  }
  return null;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.statusCode });
  }

  const mongoMsg = friendlyMongoError(error);
  if (mongoMsg) {
    return NextResponse.json({ error: mongoMsg }, { status: 400 });
  }

  const message = error instanceof Error ? error.message : "An unexpected error occurred. Please try again.";
  console.error("[API Error]", error);
  return NextResponse.json({ error: message }, { status: 500 });
}

export function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function created(data: unknown): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

// Safely convert a form value to a MongoDB ObjectId string or null.
// Handles empty string, "null", "undefined", and other invalid values.
export function toId(val: unknown): string | null {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s === "null" || s === "undefined" || s === "0") return null;
  if (!/^[a-f\d]{24}$/i.test(s)) return null;
  return s;
}
