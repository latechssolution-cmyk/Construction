import { NextResponse } from "next/server";
import { requireAuth, handleApiError, ApiError } from "@/lib/api-helpers";
import crypto from "crypto";

// Returns a signed upload token — browser uploads directly to Cloudinary
export async function GET() {
  try {
    await requireAuth();

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      throw new ApiError(500, "Cloudinary credentials not configured");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "construction-erp";
    const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

    return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder });
  } catch (e) {
    return handleApiError(e);
  }
}
