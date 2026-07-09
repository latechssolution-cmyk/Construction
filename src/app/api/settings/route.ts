import { NextRequest } from "next/server";
import { requireAuth, requireRole, handleApiError, ok, toId } from "@/lib/api-helpers";
import { auditLog } from "@/lib/audit";
import { connectDB } from "@/lib/mongoose";
import Settings from "@/models/Settings";

export async function GET() {
  try {
    await requireAuth();
    await connectDB();
    
    // Fetch settings document (upsert default if none exists)
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        companyName: process.env.NEXT_PUBLIC_APP_NAME || "Construction Management ERP",
        currency: "PKR",
        taxPercent: 16,
        retentionPercent: 10,
        whtPercent: 7.5,
      });
    }
    
    return ok(settings);
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth();
    requireRole(session, "admin", "ceo");
    const data = await req.json();
    await connectDB();

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings({});
    }

    if (data.companyName !== undefined) settings.companyName = data.companyName.trim();
    if (data.address !== undefined) settings.address = data.address.trim();
    if (data.phone !== undefined) settings.phone = data.phone.trim();
    if (data.email !== undefined) settings.email = data.email.trim();
    if (data.currency !== undefined) settings.currency = data.currency.trim();
    
    if (data.taxPercent !== undefined) {
      const tax = parseFloat(data.taxPercent);
      if (!isNaN(tax)) settings.taxPercent = Math.max(0, Math.min(100, tax));
    }
    if (data.retentionPercent !== undefined) {
      const ret = parseFloat(data.retentionPercent);
      if (!isNaN(ret)) settings.retentionPercent = Math.max(0, Math.min(100, ret));
    }
    if (data.whtPercent !== undefined) {
      const wht = parseFloat(data.whtPercent);
      if (!isNaN(wht)) settings.whtPercent = Math.max(0, Math.min(100, wht));
    }
    if (data.fiscalYearStart !== undefined) {
      settings.fiscalYearStart = data.fiscalYearStart ? new Date(data.fiscalYearStart) : null;
    }

    settings.updatedById = toId(session.user.id) as any;
    await settings.save();

    void auditLog(session.user.id, "UPDATE", "Settings", settings.id, "Updated company settings");
    return ok(settings);
  } catch (e) {
    return handleApiError(e);
  }
}
