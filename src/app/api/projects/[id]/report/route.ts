import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleApiError, ApiError } from "@/lib/api-helpers";
import { generateProjectReportPDF } from "@/lib/pdf-generator";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const project = await Project.findById(id, { name: 1 });
    if (!project) throw new ApiError(404, "Project not found");
    const buffer = await generateProjectReportPDF(id);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="project-report-${project.name.replace(/\s+/g, "-")}.pdf"`,
        "Content-Length": String(buffer.length),
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
