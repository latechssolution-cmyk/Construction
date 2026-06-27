import { MongoClient } from "mongodb";

const options = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
};

const globalWithMongo = globalThis as typeof globalThis & {
  _mongoClientPromise?: Promise<MongoClient>;
};

function createClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI environment variable is not set");

  if (process.env.NODE_ENV === "development") {
    if (!globalWithMongo._mongoClientPromise) {
      const client = new MongoClient(uri, options);
      globalWithMongo._mongoClientPromise = client.connect();
    }
    return globalWithMongo._mongoClientPromise!;
  }

  const client = new MongoClient(uri, options);
  return client.connect();
}

// Lazily evaluated — only throws when MONGODB_URI is missing at runtime, not at build time
const clientPromise: Promise<MongoClient> = (() => {
  if (!process.env.MONGODB_URI) {
    return new Promise<MongoClient>((_, reject) =>
      reject(new Error("MONGODB_URI environment variable is not set"))
    );
  }
  return createClientPromise();
})();

export default clientPromise;
