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
      // Without these three env vars no file can ever upload — surface an
      // actionable message instead of a generic failure so whoever hits
      // this knows it's a deployment-configuration problem, not a bug.
      throw new ApiError(503, "File storage is not configured on the server. An administrator must set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in the environment (see DEPLOY.md).");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const folder = "construction-erp";
    // maxFileSize is a CLIENT-side pre-check only. Cloudinary does not
    // include max_file_size in its signature computation — signing it here
    // made every upload fail with 401 "Invalid Signature" (Cloudinary's
    // expected string is just folder+timestamp, verified against its error
    // response). Sign exactly what Cloudinary signs.
    const maxFileSize = 50 * 1024 * 1024;
    const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

    return NextResponse.json({ signature, timestamp, apiKey, cloudName, folder, maxFileSize });
  } catch (e) {
    return handleApiError(e);
  }
}
