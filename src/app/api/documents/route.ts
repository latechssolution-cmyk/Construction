import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Doc from "@/models/Document";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type");
    const category = searchParams.get("category");
    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    if (type) filter.type = type;
    if (category) filter.category = category;
    await connectDB();
    const documents = await Doc.find(filter)
      .populate("project", "id name")
      .populate("uploadedBy", "id name")
      .sort({ createdAt: -1 })
      .limit(500);
    return ok(documents);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const data = await req.json();
    if (!data.name?.trim()) throw new ApiError(400, "Document name is required");
    const category = data.category && DOCUMENT_CATEGORIES.includes(data.category) ? data.category : "general";
    // fileUrl is rendered directly as an <a href> on the frontend — reject
    // javascript:/data: URIs so a planted document can't run script when
    // another user clicks "Download".
    const fileUrl = data.fileUrl?.trim() || null;
    if (fileUrl && !/^(https?:\/\/|\/uploads\/)/i.test(fileUrl)) {
      throw new ApiError(400, "fileUrl must be an http(s) URL or an internal /uploads/ path");
    }
    await connectDB();
    const doc = await Doc.create({
      name: data.name,
      type: data.type || "other",
      category,
      fileUrl,
      fileType: data.fileType || null,
      fileSize: data.fileSize ? parseInt(data.fileSize) : null,
      description: data.description || null,
      projectId: toId(data.projectId),
      uploadedById: session.user.id,
      tags: data.tags || [],
    });
    void auditLog(session.user.id, "CREATE", "Document", doc.id, `Uploaded: ${doc.name}`);
    return created(doc);
  } catch (e) {
    return handleApiError(e);
  }
}
