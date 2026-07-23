import mongoose from "mongoose";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

// Resolve the DB name exactly like src/lib/mongoose.ts connectDB() does, so we
// operate on the same database the running app uses.
function resolveUri() {
  let uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  if (!uri.includes("/construction_erp")) {
    const [beforeQuery, query] = uri.split("?");
    const schemeMatch = beforeQuery.match(/^mongodb(\+srv)?:\/\//);
    const scheme = schemeMatch ? schemeMatch[0] : "mongodb://";
    const afterScheme = beforeQuery.slice(scheme.length);
    const slashIdx = afterScheme.indexOf("/");
    const hostAndAuth = slashIdx === -1 ? afterScheme : afterScheme.slice(0, slashIdx);
    uri = `${scheme}${hostAndAuth}/construction_erp${query ? "?" + query : ""}`;
  }
  return uri;
}

// old email  ->  new email  (target domain @vcc.com; generics get a "2" suffix)
const MAP = {
  "admin@constructionlatech.com": "admin@vcc.com",
  "ceo@constructionlatech.com": "ceo@vcc.com",
  "manager@constructionlatech.com": "manager@vcc.com",
  "accountant@constructionlatech.com": "accountant@vcc.com",
  "bilal@constructionlatech.com": "bilal@vcc.com",
  "sara@constructionlatech.com": "sara@vcc.com",
  "hamid@constructionlatech.com": "hamid@vcc.com",
  "admin@construction.com": "admin2@vcc.com",
  "ceo@construction.com": "ceo2@vcc.com",
  "manager@construction.com": "manager2@vcc.com",
  "accountant@construction.com": "accountant2@vcc.com",
};

const APPLY = process.argv.includes("--apply");

async function main() {
  await mongoose.connect(resolveUri(), { bufferCommands: false });
  const users = mongoose.connection.collection("users");

  console.log(APPLY ? "APPLYING migration\n" : "DRY RUN (pass --apply to write)\n");

  // Collision guard: no new email may already belong to a different account.
  for (const [oldE, newE] of Object.entries(MAP)) {
    const existing = await users.findOne({ email: newE });
    if (existing) {
      const src = await users.findOne({ email: oldE });
      if (!src || existing._id.toString() !== src._id.toString()) {
        throw new Error(`Collision: target ${newE} already exists on another account. Aborting.`);
      }
    }
  }

  let changed = 0, missing = 0;
  for (const [oldE, newE] of Object.entries(MAP)) {
    const doc = await users.findOne({ email: oldE });
    if (!doc) { console.log(`  skip (not found): ${oldE}`); missing++; continue; }
    console.log(`  ${oldE.padEnd(38)} -> ${newE}   [${doc.role}]`);
    if (APPLY) {
      await users.updateOne({ _id: doc._id }, { $set: { email: newE } });
      changed++;
    }
  }

  console.log(`\n${APPLY ? `Updated ${changed} account(s)` : "Preview only"}${missing ? `, ${missing} not found` : ""}.`);
  await mongoose.disconnect();
}

main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
