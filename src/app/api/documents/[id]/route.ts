import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok, ApiError, toId, assertManagerOwnsProject } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Doc from "@/models/Document";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";
import Project from "@/models/Project";
import fs from "fs";
import path from "path";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    const doc = await Doc.findById(id).populate("project", "id name").populate("uploadedBy", "name");
    if (!doc) throw new ApiError(404, "Document not found");
    if (session.user.role === "manager" && doc.projectId) {
      const project = await Project.findById(doc.projectId, { assignedManagerId: 1 });
      assertManagerOwnsProject(session, project);
    }
    return ok(doc);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const doc = await Doc.findById(id);
    if (!doc) throw new ApiError(404, "Document not found");

    // Only creator or admin/ceo can update document metadata
    if (doc.uploadedById?.toString() !== session.user.id && !["admin", "ceo"].includes(session.user.role)) {
      throw new ApiError(403, "Forbidden");
    }

    if (data.name !== undefined) doc.name = data.name;
    if (data.description !== undefined) doc.description = data.description;
    if (data.category !== undefined && DOCUMENT_CATEGORIES.includes(data.category)) doc.category = data.category;
    if (data.tags !== undefined) doc.tags = Array.isArray(data.tags) ? data.tags : data.tags.split(",").map((t: string) => t.trim());
    if (data.projectId !== undefined) {
      doc.projectId = data.projectId ? (typeof data.projectId === "string" ? toId(data.projectId) : data.projectId) : null;
    }

    await doc.save();
    void auditLog(session.user.id, "UPDATE", "Document", id, `Updated metadata for document: ${doc.name}`);
    return ok(doc);
  } catch (e) {
    return handleApiError(e);
  }
}

import crypto from "crypto";

async function deleteCloudinaryAsset(fileUrl: string) {
  try {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) return;

    const match = fileUrl.match(/res\.cloudinary\.com\/[^/]+\/([^/]+)\/upload\/(?:v\d+\/)?([^.]+)/);
    if (!match) return;

    const resourceType = match[1];
    const publicId = match[2];

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signatureStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash("sha1").update(signatureStr).digest("hex");

    const formData = new URLSearchParams();
    formData.append("public_id", publicId);
    formData.append("timestamp", timestamp);
    formData.append("api_key", apiKey);
    formData.append("signature", signature);

    await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/destroy`, {
      method: "POST",
      body: formData,
    });
  } catch (e) {
    console.error("[Cloudinary] Error destroying asset:", e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    const { id } = await params;
    await connectDB();
    const doc = await Doc.findById(id);
    if (!doc) throw new ApiError(404, "Document not found");
    if (doc.uploadedById?.toString() !== session.user.id && !["admin","ceo"].includes(session.user.role)) {
      throw new ApiError(403, "Forbidden");
    }
    if (doc.fileUrl) {
      if (doc.fileUrl.startsWith("/uploads/")) {
        const uploadsDir = path.join(process.cwd(), "public", "uploads");
        const filePath = path.resolve(uploadsDir, "." + doc.fileUrl.slice("/uploads".length));
        if (filePath === uploadsDir || filePath.startsWith(uploadsDir + path.sep)) {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } else {
          console.error("[Document Delete] Blocked path traversal attempt:", doc.fileUrl);
        }
      } else if (doc.fileUrl.includes("res.cloudinary.com")) {
        await deleteCloudinaryAsset(doc.fileUrl);
      }
    }
    await Doc.findByIdAndDelete(id);
    void auditLog(session.user.id, "DELETE", "Document", id, `Deleted: ${doc.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
