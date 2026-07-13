import mongoose from "mongoose";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/construction_erp";

async function wipe() {
  console.log("🌱 Connecting to MongoDB...");
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log("✅ Connected.\n");

  const db = mongoose.connection;

  // Every business-data collection except "users" — login accounts are preserved.
  const cols = [
    "bankaccounts", "clients", "vendors", "employees", "equipment",
    "projects", "projectphases", "milestones", "tasks", "projectemployees",
    "projectequipments", "equipmentmaintenances", "materials", "materialusages",
    "invoices", "ledgerentries", "contracts", "contractvariations", "documents", "attendances",
    "notifications", "auditlogs", "counters", "subcontracts", "assets",
    "partners", "investments", "loans", "loanrepayments", "storeitems", "storeitemusages",
    "payments",
  ];

  console.log("🧹 Wiping all business-data collections (keeping user accounts)...");
  for (const c of cols) {
    try {
      const result = await db.collection(c).deleteMany({});
      console.log(`  ${c}: ${result.deletedCount} documents removed`);
    } catch (e) {
      console.log(`  ${c}: skipped (collection may not exist)`);
    }
  }

  const userCount = await db.collection("users").countDocuments();
  console.log(`\n✅ Wipe complete. ${userCount} user account(s) preserved — you can log in and start entering company data fresh.`);

  await mongoose.disconnect();
  process.exit(0);
}

wipe().catch((err) => {
  console.error("❌ Wipe failed:", err);
  process.exit(1);
});
