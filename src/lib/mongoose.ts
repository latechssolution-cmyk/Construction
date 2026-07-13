import mongoose from "mongoose";

// Side-effect imports — ensures all schemas are registered before any populate() runs.
// Must be kept in dependency order (e.g. Project before Task).
import "@/models/User";
import "@/models/Client";
import "@/models/Vendor";
import "@/models/BankAccount";
import "@/models/Partner";
import "@/models/Project";
import "@/models/Contract";
import "@/models/ContractVariation";
import "@/models/Subcontract";
import "@/models/Investment";
import "@/models/Loan";
import "@/models/LoanRepayment";
import "@/models/StoreItem";
import "@/models/StoreItemUsage";
import "@/models/ProjectPhase";
import "@/models/Milestone";
import "@/models/Task";
import "@/models/Employee";
import "@/models/ProjectEmployee";
import "@/models/Equipment";
import "@/models/ProjectEquipment";
import "@/models/EquipmentMaintenance";
import "@/models/Asset";
import "@/models/Material";
import "@/models/MaterialUsage";
import "@/models/LedgerEntry";
import "@/models/Invoice";
import "@/models/Document";
import "@/models/Attendance";
import "@/models/AuditLog";
import "@/models/Notification";
import "@/models/Counter";

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

const globalWithMongoose = globalThis as typeof globalThis & {
  mongoose?: MongooseCache;
};

const cached: MongooseCache = globalWithMongoose.mongoose ?? { conn: null, promise: null };
if (!globalWithMongoose.mongoose) globalWithMongoose.mongoose = cached;

export async function connectDB(): Promise<typeof mongoose> {
  let MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("MONGODB_URI environment variable is not set");
  if (!MONGODB_URI.includes("/construction_erp")) {
    const [beforeQuery, query] = MONGODB_URI.split("?");
    const schemeMatch = beforeQuery.match(/^mongodb(\+srv)?:\/\//);
    const scheme = schemeMatch ? schemeMatch[0] : "mongodb://";
    const afterScheme = beforeQuery.slice(scheme.length);
    const slashIdx = afterScheme.indexOf("/");
    const hostAndAuth = slashIdx === -1 ? afterScheme : afterScheme.slice(0, slashIdx);
    MONGODB_URI = `${scheme}${hostAndAuth}/construction_erp${query ? "?" + query : ""}`;
  }

  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise || (cached.conn && cached.conn.connection.readyState !== 1)) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 5,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 30000,
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    throw e;
  }

  return cached.conn;
}
