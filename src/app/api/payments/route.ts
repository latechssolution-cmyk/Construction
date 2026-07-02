import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, created, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import LedgerEntry from "@/models/LedgerEntry";
import BankAccount from "@/models/BankAccount";
import Vendor from "@/models/Vendor";
import Invoice from "@/models/Invoice";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type");
    const projectId = searchParams.get("projectId");
    const vendorId = searchParams.get("vendorId");
    const filter: any = {};
    if (type) filter.type = type;
    if (projectId) filter.projectId = projectId;
    if (vendorId) filter.vendorId = vendorId;
    await connectDB();
    const entries = await LedgerEntry.find(filter)
      .populate("project", "id name")
      .populate("bankAccount", "id name")
      .populate("vendor", "id name")
      .populate("createdBy", "id name")
      .sort({ date: -1 })
      .limit(500);
    return ok(entries);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo", "accountant");
    const data = await req.json();
    if (!data.type || !data.amount || !data.date) throw new Error("type, amount, and date are required");
    const amount = parseFloat(data.amount);
    if (isNaN(amount) || amount <= 0) throw new Error("amount must be a positive number");
    await connectDB();

    // Check deactivated vendor status
    const vId = toId(data.vendorId);
    if (vId) {
      const vendor = await Vendor.findById(vId);
      if (!vendor) throw new Error("Vendor not found");
      if (vendor.isActive === false) throw new Error("Vendor is deactivated and cannot be used.");
    }

    // Issue #74: CRITICAL FIX — check bank balance BEFORE modifying invoice status
    // Previous order: invoice.save() THEN balance check → partial write on failure
    const bankAccId = toId(data.bankAccountId);
    let bankAccount: any = null;
    if (bankAccId) {
      bankAccount = await BankAccount.findById(bankAccId);
      if (!bankAccount) throw new Error("Bank account not found");
      if (data.type === "expense" && bankAccount.balance < amount) {
        throw new Error(`Insufficient funds: bank account balance is PKR ${bankAccount.balance.toLocaleString()}, but payment is PKR ${amount.toLocaleString()}`);
      }
    }

    let referenceNumber = data.referenceNumber || null;
    const invoiceId = data.invoiceId || null;
    const purchaseId = data.purchaseId || null;

    if (invoiceId) {
      const invoice = await Invoice.findById(invoiceId);
      if (!invoice) throw new Error("Invoice not found");
      if (invoice.deletedAt) throw new Error("Cannot pay a deleted invoice");
      
      // Update invoice status AFTER balance verification passes
      invoice.status = "paid";
      invoice.paidAt = new Date();
      await invoice.save();
      
      // Use invoice number as reference number to sync with delete/ledger filters
      referenceNumber = invoice.invoiceNumber;
    } else if (purchaseId) {
      const purchase = await LedgerEntry.findById(purchaseId);
      if (!purchase) throw new Error("Original credit purchase not found");
      if (purchase.category !== "accounts_payable") {
        throw new Error("Target entry is not a credit purchase (accounts_payable).");
      }
      // Convert to paid inventory asset
      purchase.category = "inventory_asset";
      purchase.bankAccountId = toId(data.bankAccountId) as any;
      await purchase.save();

      referenceNumber = purchaseId;
    }

    const entry = await LedgerEntry.create({
      date: new Date(data.date),
      type: data.type,
      amount,
      category: data.category || (invoiceId ? "invoice_payment" : (data.type === "income" ? "client_payment" : "vendor_payment")),
      description: data.description || null,
      referenceNumber,
      projectId: toId(data.projectId),
      bankAccountId: bankAccId,
      vendorId: vId,
      partyName: data.partyName || null,
      partyType: data.partyType || "other",
      receiptPath: data.receiptPath || null,
      createdById: session.user.id,
    });

    // Apply bank balance change AFTER all DB writes succeed
    if (bankAccount) {
      const delta = data.type === "income" ? amount : -amount;
      bankAccount.balance += delta;
      await bankAccount.save();
    }

    await auditLog(session.user.id, "CREATE", "Payment", entry.id, `${data.type} payment PKR ${amount}`);
    return created(entry);
  } catch (e) {
    return handleApiError(e);
  }
}
