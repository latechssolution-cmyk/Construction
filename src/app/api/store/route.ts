import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId, ApiError } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { notifyAdminsAndManagers } from "@/lib/notifications";
import { connectDB } from "@/lib/mongoose";
import { withTransaction } from "@/lib/db-transaction";
import StoreItem from "@/models/StoreItem";
import StoreItemUsage from "@/models/StoreItemUsage";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Vendor from "@/models/Vendor";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const lowStockOnly = searchParams.get("lowStock") === "1";
    await connectDB();
    const filter: any = lowStockOnly ? { $expr: { $lte: ["$stockQuantity", "$minStockLevel"] } } : {};
    const items = await StoreItem.find(filter).populate("vendor", "id name").sort({ itemName: 1 }).limit(1000).lean({ virtuals: true });
    const ids = (items as any[]).map((i: any) => i._id);
    const usageLogs = await StoreItemUsage.find({ storeItemId: { $in: ids } }).sort({ date: -1 }).limit(Math.max(ids.length * 5, 50)).lean();
    const usageMap: Record<string, any[]> = {};
    (usageLogs as any[]).forEach((u: any) => {
      const key = u.storeItemId.toString();
      if (!usageMap[key]) usageMap[key] = [];
      if (usageMap[key].length < 5) usageMap[key].push(u);
    });
    const result = (items as any[]).map((i: any) => {
      const id = i._id?.toString() || i.id;
      return { ...i, id, totalPrice: (i.quantity || 0) * (i.unitPrice || 0), usageLogs: usageMap[id] || [] };
    });
    return ok(result);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "manager", "accountant");
    const data = await req.json();
    if (!data.itemName) throw new ApiError(400, "Item name is required");
    const qty = parseFloat(data.quantity || "0");
    const price = parseFloat(data.unitPrice || "0");
    if (!Number.isFinite(qty) || qty <= 0) throw new ApiError(400, "quantity must be a positive number");
    if (!Number.isFinite(price) || price <= 0) throw new ApiError(400, "Unit price must be greater than 0");
    const minStock = parseFloat(data.minStockLevel || "5");
    if (!Number.isFinite(minStock) || minStock < 0) throw new ApiError(400, "Minimum stock level cannot be negative");

    await connectDB();
    if (data.vendorId) {
      const vendor = await Vendor.findById(toId(data.vendorId));
      if (!vendor) throw new ApiError(404, "Vendor not found");
      if (vendor.isActive === false) throw new ApiError(400, "Vendor is deactivated and cannot be used.");
    }
    const totalPrice = qty * price;
    const receivedDate = data.receivedDate ? new Date(data.receivedDate) : new Date();
    const bankAccountId = toId(data.bankAccountId);
    const vendorId = toId(data.vendorId);

    const item = await withTransaction(async (dbSession) => {
      const [createdItem] = await StoreItem.create(
        [{
          itemName: data.itemName,
          category: data.category || "general",
          unit: data.unit || "pcs",
          quantity: qty,
          stockQuantity: qty,
          minStockLevel: minStock,
          unitPrice: price,
          receivedDate,
          vendorId,
          notes: data.notes || null,
        }],
        { session: dbSession }
      );
      if (totalPrice > 0) {
        // A normal operating expense — general company stock isn't
        // attributable to any one project, so this ledger entry carries no
        // projectId (matches how company-wide costs are recorded elsewhere).
        await LedgerEntry.create(
          [{
            date: receivedDate,
            type: "expense",
            amount: totalPrice,
            category: "store_purchase",
            description: `${data.itemName} × ${qty} ${createdItem.unit}`,
            referenceNumber: createdItem._id.toString(),
            vendorId,
            bankAccountId,
            createdById: session.user.id,
          }],
          { session: dbSession }
        );
        if (bankAccountId) {
          await BankAccount.findByIdAndUpdate(bankAccountId, { $inc: { balance: -totalPrice } }, { session: dbSession });
        }
      }
      return createdItem;
    });

    if (qty <= minStock) {
      void notifyAdminsAndManagers("Low Stock Alert", `${item.itemName} (store) stock is low (${qty} ${item.unit} remaining)`, "warning");
    }
    void auditLog(session.user.id, "CREATE", "StoreItem", item.id, `Added store item: ${item.itemName}`);
    return created(item);
  } catch (e) {
    return handleApiError(e);
  }
}
