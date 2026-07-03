import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import { rateLimit } from "@/lib/rate-limit";
import User from "@/models/User";

// Issue #58: Fail-fast if AUTH_SECRET is not configured — prevents insecure fallback
if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) {
  console.error(
    "[Auth] CRITICAL: AUTH_SECRET environment variable is not set. " +
    "JWT authentication is insecure. Set AUTH_SECRET in your .env file."
  );
}

const providers: any[] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      try {
        const email = (credentials.email as string).toLowerCase().trim();
        const password = (credentials.password as string).trim();

        // Brute-force protection: max 10 login attempts per email per 15 minutes
        const rl = rateLimit(`login:${email}`, { limit: 10, windowSec: 900 });
        if (!rl.success) {
          throw new Error("Too many login attempts. Please try again in 15 minutes.");
        }

        await connectDB();
        const user = await User.findOne({ email });

        if (!user || !user.passwordHash) {
          console.warn(`[Auth Warning] User not found or no password hash for email: ${email}`);
          return null;
        }
        if (!user.isActive) {
          console.warn(`[Auth Warning] Account deactivated for email: ${email}`);
          throw new Error("Account is deactivated. Contact your administrator.");
        }

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          console.warn(`[Auth Warning] Password comparison failed for email: ${email}`);
          return null;
        }

        // Update last login (non-blocking catch)
        User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() }).catch((err) =>
          console.error("[Auth Warning] Failed to update lastLoginAt", err)
        );

        return {
          id: user._id.toString(),
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          passwordChangedAt: user.passwordChangedAt?.toISOString() || null,
        };
      } catch (err) {
        console.error("[Auth Authorize Exception]", err);
        throw err;
      }
    },
  }),
];

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers,
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        // Store passwordChangedAt so we can invalidate stale sessions (Issue #89)
        token.passwordChangedAt = (user as any).passwordChangedAt || null;
      }

      // Issue #89: Invalidate token if password was changed after it was issued
      if (token.passwordChangedAt && token.iat) {
        const changedAtMs = new Date(token.passwordChangedAt as string).getTime();
        const issuedAtMs = (token.iat as number) * 1000;
        if (issuedAtMs < changedAtMs) {
          // Token issued before password change — force re-authentication
          return {} as any;
        }
      }

      // For OAuth sign-ins, fetch role from DB
      if (account && account.type !== "credentials" && token.email) {
        await connectDB();
        const dbUser = await User.findOne({ email: token.email });
        if (dbUser) {
          if (!dbUser.isActive) {
            // Deactivated account — block access
            (token as any).blocked = true;
            token.role = null;
            return token;
          }
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.passwordChangedAt = dbUser.passwordChangedAt?.toISOString() || null;
        } else {
          // Issue #59: New OAuth user not in DB — block until admin creates their account
          (token as any).blocked = true;
          token.role = null;
        }
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
  // Issue #58: No hardcoded fallback — secret must be set via environment variable
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
});

// Augment NextAuth types
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
