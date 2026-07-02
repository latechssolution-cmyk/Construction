import { NextRequest } from "next/server";
import { handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { rateLimit } from "@/lib/rate-limit";
import { connectDB } from "@/lib/mongoose";
import User from "@/models/User";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// Issue #86: Forgot password recovery flow API route
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) throw new ApiError(400, "Email is required");

    const emailClean = email.toLowerCase().trim();

    // Rate limit: max 3 requests per email per hour to prevent spamming
    const rl = rateLimit(`forgot-pw:${emailClean}`, { limit: 3, windowSec: 3600 });
    if (!rl.success) {
      throw new ApiError(429, "Too many password recovery requests. Please try again in 1 hour.");
    }

    await connectDB();
    const user = await User.findOne({ email: emailClean });

    if (user && user.isActive) {
      // Generate secure 32-byte reset token
      const token = crypto.randomBytes(32).toString("hex");
      const expires = new Date(Date.now() + 3600000); // 1 hour validity

      user.resetPasswordToken = token;
      user.resetPasswordExpires = expires;
      await user.save();

      // Since there is no SMTP gateway, print reset link to server logs (Issue #4 / #86)
      console.log(
        `\n[SECURITY] Password reset requested for user: ${emailClean}\n` +
        `Reset Link: http://localhost:3000/reset-password?token=${token}\n` +
        `Token expires at: ${expires.toISOString()}\n`
      );
    }

    // Generic success response to prevent email enumeration attacks
    return ok({
      success: true,
      message: "If the email is registered, you will receive a password reset link shortly.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { token, newPassword } = await req.json();
    if (!token || !newPassword) {
      throw new ApiError(400, "Token and new password are required");
    }

    if (newPassword.length < 8) {
      throw new ApiError(400, "Password must be at least 8 characters long");
    }
    if (!/[A-Z]/.test(newPassword)) {
      throw new ApiError(400, "Password must contain at least one uppercase letter");
    }
    if (!/[0-9]/.test(newPassword)) {
      throw new ApiError(400, "Password must contain at least one number");
    }

    await connectDB();
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: new Date() },
    });

    if (!user) {
      throw new ApiError(400, "Invalid or expired password reset token.");
    }

    // Update password, clear token, set passwordChangedAt (to invalidate sessions, Issue #89)
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    user.passwordChangedAt = new Date();
    await user.save();

    return ok({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });
  } catch (e) {
    return handleApiError(e);
  }
}
