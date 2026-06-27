import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Doc from "@/models/Document";
import fs from "fs";
import path from "path";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const doc = await Doc.findById(id).populate("project", "id name").populate("uploadedBy", "name");
    if (!doc) throw new ApiError(404, "Document not found");
    return ok(doc);
  } catch (e) {
    return handleApiError(e);
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
    if (doc.fileUrl && doc.fileUrl.startsWith("/uploads/")) {
      const filePath = path.join(process.cwd(), "public", doc.fileUrl);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await Doc.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "Document", id, `Deleted: ${doc.name}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
