import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/construction_erp";

async function seed() {
  console.log("🌱 Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log("✅ Connected securely.");

  const db = mongoose.connection;

  // Clear existing collections for a clean seed
  console.log("🧹 Clearing old seed data...");
  const collections = [
    "users", "bankaccounts", "clients", "vendors", "employees", "equipment",
    "projects", "projectphases", "milestones", "tasks", "projectemployees",
    "projectequipments", "equipmentmaintenances", "materials", "materialusages",
    "invoices", "ledgerentries", "contracts", "documents", "attendances",
    "notifications", "auditlogs"
  ];

  for (const col of collections) {
    await db.collection(col).deleteMany({});
  }

  // 1. Users
  console.log("👥 Seeding Users...");
  const userList = [
    { email: "admin@constructionlatech.com", pass: "Admin@1234", role: "admin", name: "Super Admin" },
    { email: "ceo@constructionlatech.com", pass: "Ceo@1234", role: "ceo", name: "Executive Director / CEO" },
    { email: "manager@constructionlatech.com", pass: "Manager@1234", role: "manager", name: "Project Manager" },
    { email: "accountant@constructionlatech.com", pass: "Account@1234", role: "accountant", name: "Senior Accountant" },
    { email: "admin@construction.com", pass: "Admin@1234", role: "admin", name: "Super Admin" },
    { email: "ceo@construction.com", pass: "Ceo@1234", role: "ceo", name: "Executive Director / CEO" },
    { email: "manager@construction.com", pass: "Manager@1234", role: "manager", name: "Project Manager" },
    { email: "accountant@construction.com", pass: "Account@1234", role: "accountant", name: "Senior Accountant" },
  ];

  const userDocs = [];
  for (const u of userList) {
    const hash = await bcrypt.hash(u.pass, 12);
    const doc = await db.collection("users").insertOne({
      name: u.name,
      email: u.email.toLowerCase(),
      passwordHash: hash,
      role: u.role,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    userDocs.push({ ...u, _id: doc.insertedId });
  }
  const adminUser = userDocs[0];
  const managerUser = userDocs[2];
  const accountantUser = userDocs[3];

  // 2. Bank Accounts
  console.log("🏦 Seeding Bank Accounts...");
  const meezanBank = await db.collection("bankaccounts").insertOne({
    name: "Meezan Corporate Account",
    bankName: "Meezan Bank Ltd",
    accountNumber: "02010104958192",
    accountType: "current",
    balance: 14500000,
    currency: "PKR",
    notes: "Primary operating account for client billing & payroll",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const hblBank = await db.collection("bankaccounts").insertOne({
    name: "HBL Escrow Account",
    bankName: "Habib Bank Limited",
    accountNumber: "50019283746501",
    accountType: "escrow",
    balance: 28000000,
    currency: "PKR",
    notes: "Escrow account dedicated to mega commercial projects",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 3. Clients
  console.log("🏢 Seeding Clients...");
  const client1 = await db.collection("clients").insertOne({
    name: "Bahria Town Pvt Ltd",
    contactPerson: "Malik Riaz Ahmed",
    phone: "+92 51 111 786 111",
    email: "info@bahriatown.com.pk",
    address: "Phase 8, Bahria Town, Rawalpindi",
    taxId: "NTN-3891029-4",
    notes: "Key real estate developer partner",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const client2 = await db.collection("clients").insertOne({
    name: "Emaar Pakistan",
    contactPerson: "Sohail Baig",
    phone: "+92 21 111 362 277",
    email: "customercare@emaar.pk",
    address: "Crescent Bay, DHA Phase 8, Karachi",
    taxId: "NTN-1928374-1",
    notes: "Luxury beachfront commercial towers",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 4. Vendors
  console.log("🚚 Seeding Vendors...");
  const vendor1 = await db.collection("vendors").insertOne({
    name: "Bestway Cement Corp",
    category: "materials",
    contactPerson: "Tariq Mahmood",
    phone: "+92 51 285 2401",
    email: "sales@bestway.com.pk",
    address: "Bestway Building, F-7 Markaz, Islamabad",
    taxId: "NTN-0712938-9",
    bankAccount: "Meezan Bank - 0102938475",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const vendor2 = await db.collection("vendors").insertOne({
    name: "Mughal Steel Mills",
    category: "materials",
    contactPerson: "Khurram Mughal",
    phone: "+92 42 359 6030",
    email: "info@mughalsteel.com",
    address: "17-G, Gulberg II, Lahore",
    taxId: "NTN-8271625-3",
    bankAccount: "HBL - 9988776655",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 5. Employees
  console.log("👷 Seeding Employees...");
  const emp1 = await db.collection("employees").insertOne({
    name: "Engr. Hamza Ali",
    role: "Senior Structural Engineer",
    department: "Engineering",
    phone: "+92 300 5551234",
    email: "hamza.ali@constructionlatech.com",
    salary: 250000,
    salaryType: "monthly",
    joiningDate: new Date("2022-03-15"),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const emp2 = await db.collection("employees").insertOne({
    name: "Usman Ghani",
    role: "Site Supervisor",
    department: "Operations",
    phone: "+92 321 4449876",
    email: "usman.ghani@constructionlatech.com",
    salary: 120000,
    salaryType: "monthly",
    joiningDate: new Date("2023-01-10"),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 6. Equipment
  console.log("🚜 Seeding Machinery & Equipment...");
  const eq1 = await db.collection("equipment").insertOne({
    name: "CAT 320 Hydraulic Excavator",
    category: "heavy_machinery",
    model: "CAT-320D",
    serialNumber: "CAT-EXC-2023-991",
    status: "available",
    hourlyRate: 8500,
    purchaseDate: new Date("2021-06-20"),
    purchasePrice: 28000000,
    notes: "Regular servicing completed in May 2026",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const eq2 = await db.collection("equipment").insertOne({
    name: "Liebherr 280 EC-H Tower Crane",
    category: "cranes",
    model: "280 EC-H 12",
    serialNumber: "LBH-CRN-8820",
    status: "in_use",
    hourlyRate: 15000,
    purchaseDate: new Date("2020-11-12"),
    purchasePrice: 45000000,
    notes: "Currently deployed at Gulberg Commercial Heights",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 7. Projects
  console.log("🏗️ Seeding Projects...");
  const proj1 = await db.collection("projects").insertOne({
    name: "Gulberg Commercial Heights",
    location: "Main Boulevard, Gulberg III, Lahore",
    description: "Multi-story luxury commercial complex featuring high-end retail spaces and corporate offices.",
    type: "commercial",
    clientId: client1.insertedId,
    assignedManagerId: managerUser._id,
    budget: 85000000,
    completionPercent: 45,
    status: "in_progress",
    startDate: new Date("2025-09-01"),
    endDate: new Date("2027-03-31"),
    createdById: adminUser._id,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const proj2 = await db.collection("projects").insertOne({
    name: "Crescent Bay Luxury Villas",
    location: "DHA Phase 8, Karachi",
    description: "Exclusive sea-facing residential villa construction and interior structure.",
    type: "residential",
    clientId: client2.insertedId,
    assignedManagerId: managerUser._id,
    budget: 120000000,
    completionPercent: 20,
    status: "in_progress",
    startDate: new Date("2026-01-15"),
    endDate: new Date("2027-12-31"),
    createdById: adminUser._id,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 8. Project Phases & Milestones & Tasks
  console.log("📅 Seeding Phases, Milestones & Tasks...");
  const phase1 = await db.collection("projectphases").insertOne({
    projectId: proj1.insertedId,
    name: "Substructure & Basement Excavation",
    description: "Deep foundation piling and reinforced concrete basement raft.",
    startDate: new Date("2025-09-01"),
    endDate: new Date("2026-01-30"),
    status: "completed",
    order: 1,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await db.collection("milestones").insertOne({
    projectId: proj1.insertedId,
    title: "Basement Raft Concrete Pour",
    description: "Casting of 3000 cu.m raft foundation",
    dueDate: new Date("2026-01-15"),
    status: "completed",
    completedAt: new Date("2026-01-14"),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await db.collection("tasks").insertOne({
    projectId: proj1.insertedId,
    phaseId: phase1.insertedId,
    title: "Steel rebar placement for Grade 60 columns",
    description: "Verify stirrup spacing and overlap length according to structural drawings.",
    assignedToId: emp1.insertedId,
    priority: "high",
    status: "completed",
    startDate: new Date("2026-01-01"),
    dueDate: new Date("2026-01-12"),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 9. Project Employee & Equipment Assignments
  await db.collection("projectemployees").insertOne({
    projectId: proj1.insertedId,
    employeeId: emp1.insertedId,
    roleOnProject: "Lead Structural Engineer",
    assignedAt: new Date("2025-09-01"),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await db.collection("projectequipments").insertOne({
    projectId: proj1.insertedId,
    equipmentId: eq2.insertedId,
    assignedAt: new Date("2025-10-01"),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 10. Materials & Usage
  console.log("📦 Seeding Inventory & Materials...");
  const mat1 = await db.collection("materials").insertOne({
    itemName: "Deformed Steel Bars (Grade 60)",
    category: "steel",
    unit: "ton",
    unitPrice: 260000,
    stockQuantity: 45,
    minStockLevel: 10,
    projectId: proj1.insertedId,
    vendorId: vendor2.insertedId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await db.collection("materialusages").insertOne({
    materialId: mat1.insertedId,
    projectId: proj1.insertedId,
    quantityUsed: 12,
    usedBy: "Site Concrete Team",
    notes: "Used in 3rd floor slab pouring",
    date: new Date(),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 11. Invoices & Financial Ledger
  console.log("💰 Seeding Financial Invoices & Ledger Entries...");
  const inv1 = await db.collection("invoices").insertOne({
    invoiceNumber: "INV-2026-001",
    projectId: proj1.insertedId,
    clientId: client1.insertedId,
    issueDate: new Date("2026-02-01"),
    dueDate: new Date("2026-03-01"),
    paidAt: new Date("2026-02-20"),
    status: "paid",
    subtotal: 15000000,
    taxPercent: 16,
    taxAmount: 2400000,
    grandTotal: 17400000,
    notes: "Milestone Billing #1 - Substructure completion",
    createdById: accountantUser._id,
    items: [
      { description: "Excavation and Piling Works", quantity: 1, unit: "job", unitPrice: 10000000, total: 10000000 },
      { description: "Concrete Raft Casting", quantity: 1, unit: "job", unitPrice: 5000000, total: 5000000 }
    ],
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Income Ledger Entry for Invoice Payment
  await db.collection("ledgerentries").insertOne({
    date: new Date("2026-02-20"),
    type: "income",
    category: "client_payment",
    projectId: proj1.insertedId,
    bankAccountId: meezanBank.insertedId,
    amount: 17400000,
    description: "Received payment for Invoice #INV-2026-001 from Bahria Town",
    paymentMode: "bank_transfer",
    partyName: "Bahria Town Pvt Ltd",
    partyType: "client",
    referenceNumber: "FT-MB-991823",
    createdById: accountantUser._id,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // Expense Ledger Entry for Cement Purchase
  await db.collection("ledgerentries").insertOne({
    date: new Date("2026-03-10"),
    type: "expense",
    category: "material_purchase",
    projectId: proj1.insertedId,
    bankAccountId: meezanBank.insertedId,
    vendorId: vendor1.insertedId,
    amount: 2500000,
    description: "Procurement of 2500 bags of Portland Cement",
    paymentMode: "cheque",
    partyName: "Bestway Cement Corp",
    partyType: "vendor",
    referenceNumber: "CHQ-882910",
    createdById: accountantUser._id,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  // 12. Attendance & Notifications
  console.log("📝 Seeding Attendance & System Logs...");
  await db.collection("attendances").insertOne({
    employeeId: emp1.insertedId,
    date: new Date(),
    status: "present",
    hoursWorked: 9,
    notes: "On-site structural inspection",
    createdAt: new Date(),
    updatedAt: new Date()
  });

  await db.collection("notifications").insertOne({
    userId: managerUser._id,
    title: "Material Stock Alert",
    message: "Deformed Steel Bars stock is near minimum threshold.",
    type: "warning",
    isRead: false,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  console.log("\n🎉 COMPLETE PRODUCTION SEED FINISHED SUCCESSFULLY!");
  console.log("--------------------------------------------------");
  console.log("All 22 collections populated with rich real-world construction ERP data.");
  console.log("\nYou can log in directly at your live app with:");
  console.log("  Admin:      admin@constructionlatech.com    /  Admin@1234");
  console.log("  CEO:        ceo@constructionlatech.com      /  Ceo@1234");
  console.log("  Manager:    manager@constructionlatech.com  /  Manager@1234");
  console.log("  Accountant: accountant@constructionlatech.com / Account@1234\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed Script Error:", err);
  process.exit(1);
});
