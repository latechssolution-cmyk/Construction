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

// Fail hard rather than silently signing sessions with a secret that is
// checked into source control — anyone reading the code could otherwise
// forge a valid admin session token.
const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
if (!authSecret) {
  throw new Error(
    "AUTH_SECRET (or NEXTAUTH_SECRET) environment variable is not set. Refusing to start with an insecure default secret."
  );
}

// Re-check role/active status against the DB at most this often, so a
// deactivation or role change takes effect quickly without a DB round trip
// on every single request.
const SESSION_REVALIDATE_MS = 60_000;

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
      const now = Date.now();

      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.roleCheckedAt = now;
      }

      if (account && account.type !== "credentials" && token.email) {
        await connectDB();
        const dbUser = await User.findOne({ email: token.email });
        if (dbUser && dbUser.isActive) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role;
          token.roleCheckedAt = now;
          token.blocked = false;
        } else {
          // No provisioned/active DB user for this OAuth email. Deleting
          // id/role alone isn't enough — the edge middleware's own jwt
          // callback (middleware.ts) never sets this, it only reads
          // token.blocked from the JWT payload this callback produces. Without
          // setting it here, an unprovisioned Google sign-in slips past the
          // middleware's `user?.blocked` gate and the page shell loads (API
          // calls still fail via requireAuth(), but the intended "Account not
          // provisioned" redirect never fires).
          delete token.id;
          delete token.role;
          token.blocked = true;
        }
      }

      if (token.id) {
        const checkedAt = typeof token.roleCheckedAt === "number" ? token.roleCheckedAt : 0;
        if (now - checkedAt > SESSION_REVALIDATE_MS) {
          await connectDB();
          const dbUser = await User.findById(token.id as string, { role: 1, isActive: 1 });
          if (dbUser && dbUser.isActive) {
            token.role = dbUser.role;
            token.roleCheckedAt = now;
          } else {
            delete token.id;
            delete token.role;
          }
        }
      }


      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = (token.id as string) || "";
        session.user.role = (token.role as string) || "";
      }
      return session;
    },
  },
  secret: authSecret,
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
