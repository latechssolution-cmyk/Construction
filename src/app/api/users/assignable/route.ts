import { NextResponse } from "next/server";
import { requireAuth, handleApiError } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    const users = await User.find({ isActive: true }, { name: 1, role: 1 }).sort({ name: 1 });
    return NextResponse.json(users);
  } catch (e) {
    return handleApiError(e);
  }
}
