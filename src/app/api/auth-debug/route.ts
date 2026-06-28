import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  const results: Record<string, unknown> = {};

  try {
    const body = await req.json();
    const email = (body.email || "").toLowerCase().trim();
    const password = (body.password || "").trim();
    results.inputEmail = email;
    results.inputPasswordLength = password.length;

    // Step 1: Check env vars
    results.hasMongoDBURI = !!process.env.MONGODB_URI;
    results.hasAuthSecret = !!process.env.AUTH_SECRET;
    results.hasNextAuthURL = !!process.env.NEXTAUTH_URL;
    results.nextAuthURL = process.env.NEXTAUTH_URL || "(not set)";
    results.nodeEnv = process.env.NODE_ENV;

    // Step 2: Test MongoDB connection
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      results.error = "MONGODB_URI is not set";
      return NextResponse.json(results, { status: 500 });
    }

    const conn = await mongoose.connect(uri, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
    });
    results.mongoConnected = true;
    results.mongoReadyState = conn.connection.readyState;

    // Step 3: Look up user
    const user = await conn.connection.collection("users").findOne({ email });
    if (!user) {
      results.userFound = false;
      results.allEmails = await conn.connection
        .collection("users")
        .find({}, { projection: { email: 1, role: 1, isActive: 1, _id: 0 } })
        .toArray();
      return NextResponse.json(results);
    }

    results.userFound = true;
    results.userEmail = user.email;
    results.userRole = user.role;
    results.userIsActive = user.isActive;
    results.hasPasswordHash = !!user.passwordHash;
    results.passwordHashPrefix = user.passwordHash
      ? user.passwordHash.substring(0, 10) + "..."
      : "(none)";

    // Step 4: Test bcrypt comparison
    if (user.passwordHash && password) {
      const match = await bcrypt.compare(password, user.passwordHash);
      results.bcryptMatch = match;

      // Double-check: hash the password and compare
      const newHash = await bcrypt.hash(password, 10);
      results.newHashWouldMatch = await bcrypt.compare(password, newHash);
    }

    return NextResponse.json(results);
  } catch (err: any) {
    results.error = err.message;
    results.stack = err.stack?.split("\n").slice(0, 5);
    return NextResponse.json(results, { status: 500 });
  }
}
