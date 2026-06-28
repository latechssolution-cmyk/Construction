import mongoose from "mongoose";

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
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) throw new Error("MONGODB_URI environment variable is not set");

  if (cached.conn && cached.conn.connection.readyState === 1) {
    return cached.conn;
  }

  if (!cached.promise || (cached.conn && cached.conn.connection.readyState !== 1)) {
    cached.promise = mongoose.connect(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
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
