import NextAuth from "next-auth";
import { NextResponse } from "next/server";

const edgeAuthSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (!edgeAuthSecret) {
  throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) environment variable is not set.");
}

// AUTH_URL/NEXTAUTH_URL isn't required — trustHost below makes NextAuth infer
// the URL from the request's Host header instead. But if someone sets it to
// a non-URL value by mistake (e.g. pastes the app display name into the
// wrong env var field), Auth.js's own internal parsing throws and takes the
// whole build down with it. Strip a malformed value here so it falls back
// to the working trustHost inference instead of crashing.
for (const key of ["AUTH_URL", "NEXTAUTH_URL"]) {
  const val = process.env[key];
  if (val) {
    try {
      new URL(val.startsWith("http") ? val : `https://${val}`);
    } catch {
      console.warn(`[Auth] ${key} is not a valid URL ("${val}") — ignoring it; relying on trustHost inference instead.`);
      delete process.env[key];
    }
  }
}

// Lightweight auth config for Edge middleware — no Mongoose/adapter imports.
// JWT is verified using only the AUTH_SECRET without touching the database.
// This only guards page routing; it cannot see DB-side deactivation/role
// changes (no DB access at the Edge). The API layer (lib/auth.ts + requireAuth)
// revalidates isActive/role against the DB, so a deactivated user loses real
// data access within ~60s even if this middleware still lets the page shell load.
const { auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  secret: edgeAuthSecret,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.blocked = (token as any).blocked || false;
      }
      return session;
    },
  },
});

const PUBLIC_PATHS = ["/login", "/api/auth"];

// Issue #57: Role-based route protection — defense-in-depth (API routes are also individually guarded)
const ROLE_RESTRICTED_PATHS: { prefix: string; roles: string[] }[] = [
  { prefix: "/api/users", roles: ["admin", "ceo"] },
  { prefix: "/api/audit", roles: ["admin", "ceo"] },
  { prefix: "/api/audit-log", roles: ["admin", "ceo"] },
];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (pathname === "/login") {
    if (req.auth?.user && !req.nextUrl.searchParams.has("error") && !req.nextUrl.searchParams.has("loggedOut")) {
      const dashUrl = req.nextUrl.clone();
      dashUrl.pathname = "/dashboard";
      return NextResponse.redirect(dashUrl);
    }
    const response = NextResponse.next();
    response.cookies.set("next-auth.session-token", "", { path: "/", maxAge: 0, expires: new Date(0) });
    response.cookies.set("__Secure-next-auth.session-token", "", { path: "/", maxAge: 0, expires: new Date(0) });
    response.cookies.set("next-auth.callback-url", "", { path: "/", maxAge: 0, expires: new Date(0) });
    response.cookies.set("next-auth.csrf-token", "", { path: "/", maxAge: 0, expires: new Date(0) });
    return response;
  }
  if (isPublic) return NextResponse.next();

  if (!req.auth?.user) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = req.auth?.user as any;

  // Issue #59: Block OAuth users not yet provisioned in the DB (token.blocked = true)
  if (user?.blocked) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({ error: "Account not provisioned. Contact your administrator." }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("error", "AccessDenied");
    return NextResponse.redirect(loginUrl);
  }

  // Issue #57: Enforce role-based page/API access
  const userRole = user?.role as string | undefined;
  const restricted = ROLE_RESTRICTED_PATHS.find((r) => pathname.startsWith(r.prefix));
  if (restricted && (!userRole || !restricted.roles.includes(userRole))) {
    if (pathname.startsWith("/api/")) {
      return new NextResponse(
        JSON.stringify({ error: "Forbidden: insufficient role" }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }
    // Redirect restricted page access to dashboard
    const dashUrl = req.nextUrl.clone();
    dashUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|images|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      blocked?: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

