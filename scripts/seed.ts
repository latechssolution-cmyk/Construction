import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/construction_erp";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, lowercase: true },
  passwordHash: String,
  role: { type: String, enum: ["admin", "ceo", "manager", "accountant"], default: "manager" },
  isActive: { type: Boolean, default: true },
  emailVerified: Date,
  image: String,
  lastLoginAt: Date,
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", userSchema);

async function seed() {
  console.log("🌱 Connecting to MongoDB:", MONGODB_URI.replace(/:([^@/]+)@/, ":***@"));
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log("✅ Connected");

  const admins = [
    { name: "Super Admin", email: "admin@construction.com", password: "Admin@123", role: "admin" },
    { name: "CEO User", email: "ceo@construction.com", password: "Ceo@12345", role: "ceo" },
    { name: "Manager User", email: "manager@construction.com", password: "Manager@123", role: "manager" },
    { name: "Accountant User", email: "accountant@construction.com", password: "Account@123", role: "accountant" },
    { name: "Super Admin", email: "admin@constructionlatech.com", password: "Admin@1234", role: "admin" },
    { name: "CEO User", email: "ceo@constructionlatech.com", password: "Ceo@1234", role: "ceo" },
    { name: "Manager User", email: "manager@constructionlatech.com", password: "Manager@1234", role: "manager" },
    { name: "Accountant User", email: "accountant@constructionlatech.com", password: "Account@1234", role: "accountant" },
  ];

  for (const admin of admins) {
    const existing = await User.findOne({ email: admin.email });
    if (existing) {
      console.log(`⏭️  Skipping existing user: ${admin.email}`);
      continue;
    }
    const passwordHash = await bcrypt.hash(admin.password, 12);
    await User.create({
      name: admin.name,
      email: admin.email,
      passwordHash,
      role: admin.role,
      isActive: true,
    });
    console.log(`✅ Created ${admin.role}: ${admin.email} (password: ${admin.password})`);
  }

  console.log("\n🎉 Seed completed successfully!");
  console.log("\nYou can log in with:");
  for (const a of admins) {
    console.log(`  ${a.role.padEnd(12)} ${a.email.padEnd(35)} ${a.password}`);
  }
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
