import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers, checkBudgetAlert } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const material = await Material.findById(id)
      .populate("project", "id name")
      .populate("vendor", "id name");
    if (!material) throw new ApiError(404, "Material not found");
    const usageLogs = await MaterialUsage.find({ materialId: id }).sort({ date: -1 });
    return ok({ ...material.toJSON(), usageLogs });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    const data = await req.json();
    await connectDB();
    const material = await Material.findById(id);
    if (!material) throw new ApiError(404, "Material not found");

    // ── Restock: add quantity at a (potentially new) price ──────────────────
    if (data.restockQuantity !== undefined) {
      const addQty = parseFloat(data.restockQuantity);
      if (!addQty || addQty <= 0) throw new ApiError(400, "Restock quantity must be greater than zero");

      const newPrice = data.unitPrice ? parseFloat(data.unitPrice) : material.unitPrice;
      const restockCost = addQty * newPrice;
      const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();

      material.stockQuantity += addQty;
      material.quantity += addQty;
      material.unitPrice = newPrice;
      material.totalPrice += restockCost;
      if (data.vendorId !== undefined) material.vendorId = toId(data.vendorId) as any;
      if (data.notes !== undefined) material.notes = data.notes;
      await material.save();

      // Record the expense in the ledger and update bank balance
      if (restockCost > 0) {
        const bankAccountId = toId(data.bankAccountId) ?? null;
        await LedgerEntry.create({
          date: receivedDate,
          type: "expense",
          amount: restockCost,
          category: "material_purchase",
          description: `Restock: ${material.itemName} × ${addQty} ${material.unit} @ PKR ${newPrice.toLocaleString()}/unit`,
          projectId: material.projectId,
          vendorId: toId(data.vendorId) ?? material.vendorId ?? null,
          bankAccountId,
          createdById: session.user.id,
        });
        if (bankAccountId) {
          await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: -restockCost } });
        }
        void checkBudgetAlert(material.projectId?.toString(), restockCost);
      }

      // Low stock alert after restocking (edge case: still low after restock)
      if (material.stockQuantity <= material.minStockLevel) {
        await notifyAdminsAndManagers(
          "Low Stock Alert",
          `${material.itemName} stock is still low after restock (${material.stockQuantity} ${material.unit} remaining)`,
          "warning"
        );
      }

      await auditLog(session.user.id, "UPDATE", "Material", id,
        `Restocked ${material.itemName}: +${addQty} ${material.unit} @ PKR ${newPrice}/unit`);
      return ok(material);
    }

    // ── Regular edit: update fields only ────────────────────────────────────
    if (data.itemName !== undefined) material.itemName = data.itemName;
    if (data.category !== undefined) material.category = data.category;
    if (data.unit !== undefined) material.unit = data.unit;
    const parsedMinStock = data.minStockLevel !== undefined ? parseFloat(data.minStockLevel) : NaN;
    if (!isNaN(parsedMinStock)) material.minStockLevel = parsedMinStock;
    const parsedStockQty = data.stockQuantity !== undefined ? parseFloat(data.stockQuantity) : NaN;
    if (!isNaN(parsedStockQty)) material.stockQuantity = parsedStockQty;
    const parsedQty = data.quantity !== undefined ? parseFloat(data.quantity) : NaN;
    if (!isNaN(parsedQty)) material.quantity = parsedQty;
    const parsedUnitPrice = data.unitPrice !== undefined ? parseFloat(data.unitPrice) : NaN;
    if (!isNaN(parsedUnitPrice)) { material.unitPrice = parsedUnitPrice; material.totalPrice = material.quantity * parsedUnitPrice; }
    if (data.vendorId !== undefined) material.vendorId = toId(data.vendorId) as any;
    if (data.notes !== undefined) material.notes = data.notes;
    await material.save();

    await auditLog(session.user.id, "UPDATE", "Material", id, `Updated: ${material.itemName}`);
    return ok(material);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager");
    const { id } = await params;
    await connectDB();
    const material = await Material.findById(id);
    if (!material) throw new ApiError(404, "Material not found");
    await MaterialUsage.deleteMany({ materialId: id });
    await Material.findByIdAndDelete(id);
    await auditLog(session.user.id, "DELETE", "Material", id, `Deleted material: ${material.itemName}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
