import mongoose from "mongoose";

/**
 * Run `fn` inside a MongoDB transaction so multi-document money mutations
 * (ledger entry + bank balance, invoice + ledger entry, etc.) either fully
 * apply or fully roll back — no more "reversed the old balance, then crashed
 * before applying the new one" partial-write bugs.
 *
 * Falls back to running `fn` without a session if the connected MongoDB
 * deployment doesn't support transactions (standalone instance, no replica
 * set — e.g. a bare `mongodb://localhost` used for local dev). This keeps
 * local development working while still getting atomicity on Atlas/replica
 * set deployments in production.
 */
export async function withTransaction<T>(fn: (session: mongoose.ClientSession | undefined) => Promise<T>): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } catch (err: any) {
    const msg = String(err?.message || err?.errmsg || "");
    const unsupported =
      msg.includes("Transaction numbers are only allowed on a replica set member or mongos") ||
      msg.includes("IllegalOperation") ||
      // Next.js dev HMR can rebind models to a fresh MongoClient while the
      // session came from the stale one ("ClientSession must be from the
      // same MongoClient") — a dev-only module-reload artifact, so fall
      // back to sessionless like the cases above rather than 500ing until
      // the dev server restarts.
      msg.includes("ClientSession must be from the same MongoClient") ||
      err?.code === 20 || // IllegalOperation
      err?.codeName === "IllegalOperation";
    if (unsupported) {
      // No replica set available (e.g. local standalone MongoDB) — run
      // without a session. Not atomic, but keeps local dev functional.
      console.warn("[withTransaction] Transactions unsupported on this MongoDB deployment; running without a session.");
      return fn(undefined);
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
