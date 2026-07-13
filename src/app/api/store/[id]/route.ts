import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, ApiError, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import StoreItem from "@/models/StoreItem";
import StoreItemUsage from "@/models/StoreItemUsage";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Vendor from "@/models/Vendor";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth();
    const { id } = await params;
    await connectDB();
    const item = await StoreItem.findById(id).populate("vendor", "id name");
    if (!item) throw new ApiError(404, "Store item not found");
    const usageLogs = await StoreItemUsage.find({ storeItemId: id }).populate("usedBy", "name").sort({ date: -1 });
    return ok({ ...item.toJSON(), usageLogs });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager", "accountant");
    const { id } = await params;
    const data = await req.json();
    await connectDB();

    if (data.vendorId) {
      const vendor = await Vendor.findById(data.vendorId);
      if (!vendor) throw new ApiError(404, "Vendor not found");
      if (vendor.isActive === false) throw new ApiError(400, "Vendor is deactivated and cannot be used.");
    }

    const item = await StoreItem.findById(id);
    if (!item) throw new ApiError(404, "Store item not found");

    // ── Restock ───────────────────────────────────────────────────────────
    if (data.restockQuantity !== undefined) {
      const addQty = parseFloat(data.restockQuantity);
      if (!addQty || addQty <= 0) throw new ApiError(400, "Restock quantity must be greater than zero");
      const newPrice = data.unitPrice !== undefined ? parseFloat(data.unitPrice) : item.unitPrice;
      if (!Number.isFinite(newPrice) || newPrice <= 0) throw new ApiError(400, "Unit price must be greater than 0");
      const restockCost = addQty * newPrice;
      const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
      const bankAccountId = toId(data.bankAccountId) ?? null;

      const updatedItem = await withTransaction(async (dbSession) => {
        const existingStockValue = item.stockQuantity * item.unitPrice;
        const newStockQuantity = item.stockQuantity + addQty;
        const newStockValue = existingStockValue + restockCost;
        const weightedUnitPrice = newStockQuantity > 0 ? newStockValue / newStockQuantity : newPrice;

        item.stockQuantity = newStockQuantity;
        item.quantity += addQty;
        item.unitPrice = weightedUnitPrice;
        if (data.vendorId !== undefined) item.vendorId = toId(data.vendorId) as any;
        if (data.notes !== undefined) item.notes = data.notes;
        await item.save({ session: dbSession });

        if (restockCost > 0) {
          await LedgerEntry.create(
            [{
              date: receivedDate,
              type: "expense",
              amount: restockCost,
              category: "store_purchase",
              description: `Restock: ${item.itemName} × ${addQty} ${item.unit} @ PKR ${newPrice.toLocaleString()}/unit`,
              vendorId: toId(data.vendorId) ?? item.vendorId ?? null,
              bankAccountId,
              createdById: session.user.id,
            }],
            { session: dbSession }
          );
          if (bankAccountId) {
            await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: -restockCost } }, { session: dbSession });
          }
        }
        return item;
      });

      if (updatedItem.stockQuantity <= updatedItem.minStockLevel) {
        void notifyAdminsAndManagers("Low Stock Alert", `${updatedItem.itemName} (store) stock is still low after restock (${updatedItem.stockQuantity} ${updatedItem.unit} remaining)`, "warning");
      }
      void auditLog(session.user.id, "UPDATE", "StoreItem", id, `Restocked ${updatedItem.itemName}: +${addQty} ${updatedItem.unit}`);
      return ok(updatedItem);
    }

    // ── Use / consume stock ──────────────────────────────────────────────
    if (data.useQuantity !== undefined) {
      const useQty = parseFloat(data.useQuantity);
      if (!useQty || useQty <= 0) throw new ApiError(400, "Use quantity must be greater than zero");
      if (useQty > item.stockQuantity) throw new ApiError(400, `Only ${item.stockQuantity} ${item.unit} in stock`);

      const updatedItem = await withTransaction(async (dbSession) => {
        item.stockQuantity -= useQty;
        await item.save({ session: dbSession });
        await StoreItemUsage.create(
          [{ storeItemId: item._id, quantityUsed: useQty, purpose: data.purpose || null, notes: data.notes || null, usedById: session.user.id }],
          { session: dbSession }
        );
        return item;
      });

      if (updatedItem.stockQuantity <= updatedItem.minStockLevel) {
        void notifyAdminsAndManagers("Low Stock Alert", `${updatedItem.itemName} (store) stock is low (${updatedItem.stockQuantity} ${updatedItem.unit} remaining)`, "warning");
      }
      void auditLog(session.user.id, "UPDATE", "StoreItem", id, `Used ${useQty} ${updatedItem.unit} of ${updatedItem.itemName}`);
      return ok(updatedItem);
    }

    // ── Regular edit ──────────────────────────────────────────────────────
    if (data.itemName !== undefined) item.itemName = data.itemName;
    if (data.category !== undefined) item.category = data.category;
    if (data.unit !== undefined) item.unit = data.unit;
    const parsedMinStock = data.minStockLevel !== undefined ? parseFloat(data.minStockLevel) : NaN;
    if (!isNaN(parsedMinStock)) {
      if (parsedMinStock < 0) throw new ApiError(400, "Minimum stock level cannot be negative");
      item.minStockLevel = parsedMinStock;
    }
    if (data.vendorId !== undefined) item.vendorId = toId(data.vendorId) as any;
    if (data.notes !== undefined) item.notes = data.notes;
    await item.save();

    void auditLog(session.user.id, "UPDATE", "StoreItem", id, `Updated: ${item.itemName}`);
    return ok(item);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const { id } = await params;
    await connectDB();
    const item = await StoreItem.findById(id);
    if (!item) throw new ApiError(404, "Store item not found");

    const relatedEntries = await LedgerEntry.find({ referenceNumber: id, category: "store_purchase" });
    for (const entry of relatedEntries) {
      if (entry.bankAccountId) {
        await BankAccount.findByIdAndUpdate(entry.bankAccountId, { $inc: { balance: entry.amount } });
      }
      await LedgerEntry.findByIdAndDelete(entry._id);
    }

    await StoreItemUsage.deleteMany({ storeItemId: id });
    await StoreItem.findByIdAndDelete(id);
    void auditLog(session.user.id, "DELETE", "StoreItem", id, `Deleted store item: ${item.itemName}`);
    return ok({ success: true });
  } catch (e) {
    return handleApiError(e);
  }
}
