import NextAuth from "next-auth";
import { NextResponse } from "next/server";

// Lightweight auth config for Edge middleware — no Mongoose/adapter imports.
// JWT is verified using only the AUTH_SECRET without touching the database.
const { auth } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [],
  // Issue #90: Use same secret resolution as auth.ts — no undefined fallback
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
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

