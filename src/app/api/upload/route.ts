import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError, ApiError } from "@/lib/api-helpers";

// ── Cloudinary upload (production / when credentials set) ────────────────────
async function uploadToCloudinary(buffer: Buffer, filename: string, mimeType: string) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary credentials not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET in your environment.");
  }

  const crypto = await import("crypto");
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = "construction-erp";

  const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), filename);
  form.append("api_key", apiKey);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message || "Cloudinary upload failed");
  }

  const data = await res.json() as { secure_url: string; public_id: string; bytes: number };
  return { url: data.secure_url, size: data.bytes };
}

// ── Local filesystem upload (development fallback only) ──────────────────────
async function uploadToLocal(buffer: Buffer, filename: string, mimeType: string) {
  const path = await import("path");
  const fs = await import("fs");
  const { compressImage, isImage } = await import("@/lib/image-compression");
  const { v4: uuidv4 } = await import("uuid");

  const ext = path.extname(filename).toLowerCase() || ".bin";
  const uniqueName = `${uuidv4()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const filePath = path.join(uploadDir, uniqueName);
  fs.writeFileSync(filePath, buffer);

  let finalPath = `/uploads/${uniqueName}`;
  let finalSize = buffer.length;

  if (isImage(mimeType)) {
    const compressedName = `compressed_${uniqueName.replace(ext, ".jpg")}`;
    const compressedPath = path.join(uploadDir, compressedName);
    try {
      const result = await compressImage(filePath, compressedPath);
      fs.unlinkSync(filePath);
      finalPath = `/uploads/${compressedName}`;
      finalSize = result.compressedSize;
    } catch {
      console.warn("[Upload] Image compression failed, using original");
    }
  }

  return { url: finalPath, size: finalSize };
}

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain", "text/csv",
]);

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) throw new ApiError(400, "No file uploaded");

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      throw new ApiError(400, `File type '${file.type}' is not allowed. Supported: images, PDF, Word, Excel, CSV.`);
    }

    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (file.size > maxSize) throw new ApiError(400, "File too large. Maximum 50MB allowed");

    const buffer = Buffer.from(await file.arrayBuffer());

    const hasCloudinary = !!(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    );

    let result: { url: string; size: number };

    if (hasCloudinary) {
      result = await uploadToCloudinary(buffer, file.name, file.type);
    } else if (process.env.NODE_ENV === "production") {
      throw new ApiError(500, "File storage not configured. Add Cloudinary credentials to your environment variables.");
    } else {
      result = await uploadToLocal(buffer, file.name, file.type);
    }

    return NextResponse.json({
      url: result.url,
      name: file.name,
      type: file.type,
      size: result.size,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
