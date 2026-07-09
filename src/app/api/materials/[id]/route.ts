import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers, checkBudgetAlert } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import Material from "@/models/Material";
import MaterialUsage from "@/models/MaterialUsage";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Vendor from "@/models/Vendor";

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

    if (data.vendorId) {
      const vendor = await Vendor.findById(data.vendorId);
      if (!vendor) throw new ApiError(404, "Vendor not found");
      if (vendor.isActive === false) throw new ApiError(400, "Vendor is deactivated and cannot be used.");
    }

    const material = await Material.findById(id);
    if (!material) throw new ApiError(404, "Material not found");

    // ── Restock: add quantity at a (potentially new) price ──────────────────
    if (data.restockQuantity !== undefined) {
      const addQty = parseFloat(data.restockQuantity);
      if (!addQty || addQty <= 0) throw new ApiError(400, "Restock quantity must be greater than zero");
      const newPrice = data.unitPrice !== undefined ? parseFloat(data.unitPrice) : material.unitPrice;
      if (!Number.isFinite(newPrice) || newPrice <= 0) throw new ApiError(400, "Unit price must be greater than 0");
      const restockCost = addQty * newPrice;
      const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
      const bankAccountId = toId(data.bankAccountId) ?? null;

      const updatedMaterial = await withTransaction(async (dbSession) => {
        // Weighted average must be based on stock actually on hand, not the
        // lifetime total-ever-received (material.quantity) — otherwise the
        // unit cost is diluted by units that were already consumed and no
        // longer represent real inventory value.
        const existingStockValue = material.stockQuantity * material.unitPrice;
        const newStockQuantity = material.stockQuantity + addQty;
        const newStockValue = existingStockValue + restockCost;
        const weightedUnitPrice = newStockQuantity > 0 ? newStockValue / newStockQuantity : newPrice;

        material.stockQuantity = newStockQuantity;
        material.quantity += addQty;
        material.unitPrice = weightedUnitPrice;
        if (data.vendorId !== undefined) material.vendorId = toId(data.vendorId) as any;
        if (data.notes !== undefined) material.notes = data.notes;
        await material.save({ session: dbSession });

        if (restockCost > 0) {
          await LedgerEntry.create(
            [{
              date: receivedDate,
              type: "expense",
              amount: restockCost,
              category: "material_purchase",
              description: `Restock: ${material.itemName} × ${addQty} ${material.unit} @ PKR ${newPrice.toLocaleString()}/unit`,
              projectId: material.projectId,
              vendorId: toId(data.vendorId) ?? material.vendorId ?? null,
              bankAccountId,
              createdById: session.user.id,
            }],
            { session: dbSession }
          );
          if (bankAccountId) {
            await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: -restockCost } }, { session: dbSession });
          }
        }
        return material;
      });

      if (restockCost > 0) {
        void checkBudgetAlert(updatedMaterial.projectId?.toString(), restockCost);
      }

      // Low stock alert after restocking (edge case: still low after restock)
      if (updatedMaterial.stockQuantity <= updatedMaterial.minStockLevel) {
        await notifyAdminsAndManagers(
          "Low Stock Alert",
          `${updatedMaterial.itemName} stock is still low after restock (${updatedMaterial.stockQuantity} ${updatedMaterial.unit} remaining)`,
          "warning"
        );
      }

      void auditLog(session.user.id, "UPDATE", "Material", id,
        `Restocked ${updatedMaterial.itemName}: +${addQty} ${updatedMaterial.unit} @ PKR ${newPrice}/unit`);
      return ok(updatedMaterial);
    }

    // ── Regular edit: update fields only ────────────────────────────────────
    if (data.itemName !== undefined) material.itemName = data.itemName;
    if (data.category !== undefined) material.category = data.category;
    if (data.unit !== undefined) material.unit = data.unit;

    // totalPrice is a virtual (quantity * unitPrice), captured here — before
    // any of the field mutations below — so we can reconcile the linked
    // ledger entry and bank balance against the change in total value.
    // Direct quantity/price edits used to bypass financial tracking
    // entirely; this closes that gap.
    const oldTotalPrice = material.totalPrice;

    const parsedMinStock = data.minStockLevel !== undefined ? parseFloat(data.minStockLevel) : NaN;
    if (!isNaN(parsedMinStock)) {
      if (parsedMinStock < 0) throw new ApiError(400, "Minimum stock level cannot be negative");
      material.minStockLevel = parsedMinStock;
    }

    const parsedStockQty = data.stockQuantity !== undefined ? parseFloat(data.stockQuantity) : NaN;
    if (!isNaN(parsedStockQty)) {
      if (parsedStockQty < 0) throw new ApiError(400, "Stock quantity cannot be negative");
      material.stockQuantity = parsedStockQty;
    }

    const parsedQty = data.quantity !== undefined ? parseFloat(data.quantity) : NaN;
    if (!isNaN(parsedQty)) {
      if (parsedQty < 0) throw new ApiError(400, "Quantity cannot be negative");
      material.quantity = parsedQty;
    }

    const parsedUnitPrice = data.unitPrice !== undefined ? parseFloat(data.unitPrice) : NaN;
    if (!isNaN(parsedUnitPrice)) {
      if (parsedUnitPrice <= 0) throw new ApiError(400, "Unit price must be greater than 0");
      material.unitPrice = parsedUnitPrice;
    }

    const newTotalPrice = material.quantity * material.unitPrice;
    const diff = newTotalPrice - oldTotalPrice;
    if (diff !== 0) {
      const entry = await LedgerEntry.findOne({ referenceNumber: id, category: "inventory_asset" }).sort({ createdAt: 1 });
      if (entry) {
        if (entry.bankAccountId) {
          const bankAccount = await BankAccount.findById(entry.bankAccountId);
          if (bankAccount) {
            if (diff > 0 && bankAccount.balance < diff) {
              throw new ApiError(400, `Insufficient funds: bank account balance is PKR ${bankAccount.balance.toLocaleString()}, but price increase requires PKR ${diff.toLocaleString()}`);
            }
            bankAccount.balance -= diff;
            await bankAccount.save();
          }
        }
        entry.amount += diff;
        if (entry.description) {
          entry.description = `${material.itemName} × ${material.quantity} ${material.unit}`;
        }
        await entry.save();
      }
    }

    if (data.vendorId !== undefined) material.vendorId = toId(data.vendorId) as any;
    if (data.notes !== undefined) material.notes = data.notes;
    await material.save();

    void auditLog(session.user.id, "UPDATE", "Material", id, `Updated: ${material.itemName}`);
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

    const usages = await MaterialUsage.find({ materialId: id });
    const usageIds = usages.map(u => u._id.toString());

    const relatedEntries = await LedgerEntry.find({ referenceNumber: { $in: [id, ...usageIds] } });
    for (const entry of relatedEntries) {
      if (entry.bankAccountId && (entry.category === "material_purchase" || entry.category === "inventory_asset")) {
        await BankAccount.findByIdAndUpdate(entry.bankAccountId, { $inc: { balance: entry.amount } });
      }
      await LedgerEntry.findByIdAndDelete(entry._id);
    }

    await MaterialUsage.deleteMany({ materialId: id });
    await Material.findByIdAndDelete(id);
    void auditLog(session.user.id, "DELETE", "Material", id, `Deleted material: ${material.itemName}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
