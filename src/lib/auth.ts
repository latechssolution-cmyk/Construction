import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongoose";
import { rateLimit } from "@/lib/rate-limit";
import User from "@/models/User";

const providers: any[] = [
  CredentialsProvider({
    name: "credentials",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null;

      // Brute-force protection: max 10 login attempts per email per 15 minutes
      const rl = rateLimit(`login:${credentials.email}`, { limit: 10, windowSec: 900 });
      if (!rl.success) {
        throw new Error("Too many login attempts. Please try again in 15 minutes.");
      }

      const email = (credentials.email as string).toLowerCase().trim();
      const password = (credentials.password as string).trim();

      await connectDB();
      const user = await User.findOne({ email });

      if (!user || !user.passwordHash) {
        throw new Error("Invalid email or password");
      }
      if (!user.isActive) {
        throw new Error("Account is deactivated. Contact your administrator.");
      }

      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) throw new Error("Invalid email or password");

      // Update last login
      await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });

      return {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      };
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
      }
      // For OAuth sign-ins, fetch role from DB
      if (account && account.type !== "credentials" && token.email) {
        await connectDB();
        const dbUser = await User.findOne({ email: token.email });
        if (dbUser) {
          token.id = dbUser._id.toString();
          token.role = dbUser.role || "manager";
        } else {
          // New OAuth user not yet in DB — assign default role
          token.role = "manager";
        }
      }
      // Ensure role always has a fallback
      if (!token.role) token.role = "manager";
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "construction-erp-secret-key-2026",
});

// Augment NextAuth types
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}
