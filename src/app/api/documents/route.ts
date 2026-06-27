import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Doc from "@/models/Document";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId");
    const type = searchParams.get("type");
    const filter: any = {};
    if (projectId) filter.projectId = projectId;
    if (type) filter.type = type;
    await connectDB();
    const documents = await Doc.find(filter)
      .populate("project", "id name")
      .populate("uploadedBy", "id name")
      .sort({ createdAt: -1 });
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
    await connectDB();
    const doc = await Doc.create({
      name: data.name,
      type: data.type || "other",
      fileUrl: data.fileUrl || null,
      fileType: data.fileType || null,
      fileSize: data.fileSize ? parseInt(data.fileSize) : null,
      description: data.description || null,
      projectId: data.projectId || null,
      uploadedById: session.user.id,
      tags: data.tags || [],
    });
    await auditLog(session.user.id, "CREATE", "Document", doc.id, `Uploaded: ${doc.name}`);
    return created(doc);
  } catch (e) {
    return handleApiError(e);
  }
}
