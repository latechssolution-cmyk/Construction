import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import LedgerEntry from "@/models/LedgerEntry";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const entry = await LedgerEntry.findById(id)
      .populate("project", "id name")
      .populate("bankAccount", "id name")
      .populate("vendor", "id name")
      .populate("createdBy", "id name");
    if (!entry) throw new ApiError(404, "Ledger entry not found");
    return ok(entry);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "accountant");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const update: any = {};
    if (data.date !== undefined) update.date = new Date(data.date);
    if (data.type !== undefined) update.type = data.type;
    if (data.amount !== undefined) update.amount = parseFloat(data.amount);
    if (data.category !== undefined) update.category = data.category;
    if (data.description !== undefined) update.description = data.description;
    if (data.referenceNumber !== undefined) update.referenceNumber = data.referenceNumber;
    if (data.partyName !== undefined) update.partyName = data.partyName;
    if (data.partyType !== undefined) update.partyType = data.partyType;
    if (data.projectId !== undefined) update.projectId = data.projectId;
    if (data.bankAccountId !== undefined) update.bankAccountId = data.bankAccountId;
    if (data.vendorId !== undefined) update.vendorId = data.vendorId;
    const entry = await LedgerEntry.findByIdAndUpdate(id, update, { new: true });
    if (!entry) throw new ApiError(404, "Ledger entry not found");
    await auditLog(session.user.id, "UPDATE", "LedgerEntry", id, "Updated ledger entry");
    return ok(entry);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin");
    const { id } = await params;
    await connectDB();
    await LedgerEntry.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "LedgerEntry", id, "Deleted ledger entry");
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
