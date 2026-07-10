import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/construction_erp";

// ── Helpers ───────────────────────────────────────────────────────────────────
const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d; };
const daysFromNow = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
const monthsAgo = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() - n); return d; };
const monthsFromNow = (n: number) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d; };
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const rand = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const now = () => new Date();

async function seed() {
  console.log("🌱 Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGODB_URI, { bufferCommands: false });
  console.log("✅ Connected.\n");

  const db = mongoose.connection;

  // ── Clear existing data ───────────────────────────────────────────────────
  console.log("🧹 Clearing existing collections...");
  const cols = [
    "users","bankaccounts","clients","vendors","employees","equipment",
    "projects","projectphases","milestones","tasks","projectemployees",
    "projectequipments","equipmentmaintenances","materials","materialusages",
    "invoices","ledgerentries","contracts","documents","attendances",
    "notifications","auditlogs","counters","subcontracts",
  ];
  for (const c of cols) {
    try { await db.collection(c).deleteMany({}); } catch {}
  }

  // ── 1. USERS ─────────────────────────────────────────────────────────────
  console.log("👥 Seeding users...");
  const usersRaw = [
    { name: "Super Admin",              email: "admin@constructionlatech.com",     pass: "Admin@1234",   role: "admin" },
    { name: "Executive Director / CEO", email: "ceo@constructionlatech.com",       pass: "Ceo@1234",     role: "ceo" },
    { name: "Aamir Khan",               email: "manager@constructionlatech.com",   pass: "Manager@1234", role: "manager" },
    { name: "Fatima Noor",              email: "accountant@constructionlatech.com",pass: "Account@1234", role: "accountant" },
    { name: "Bilal Chaudhry",           email: "bilal@constructionlatech.com",     pass: "Manager@1234", role: "manager" },
    { name: "Sara Ahmed",               email: "sara@constructionlatech.com",      pass: "Manager@1234", role: "manager" },
    { name: "Hamid Raza",               email: "hamid@constructionlatech.com",     pass: "Account@1234", role: "accountant" },
    { name: "Admin",                    email: "admin@construction.com",           pass: "Admin@1234",   role: "admin" },
    { name: "CEO",                      email: "ceo@construction.com",             pass: "Ceo@1234",     role: "ceo" },
    { name: "Manager",                  email: "manager@construction.com",         pass: "Manager@1234", role: "manager" },
    { name: "Accountant",               email: "accountant@construction.com",      pass: "Account@1234", role: "accountant" },
  ];
  const userDocs: any[] = [];
  for (const u of usersRaw) {
    const hash = await bcrypt.hash(u.pass, 10);
    const r = await db.collection("users").insertOne({
      name: u.name, email: u.email.toLowerCase(), passwordHash: hash,
      role: u.role, isActive: true, createdAt: now(), updatedAt: now(),
    });
    userDocs.push({ ...u, _id: r.insertedId });
  }
  const admin = userDocs[0], ceo = userDocs[1];
  const managers = [userDocs[2], userDocs[4], userDocs[5]];
  const accountant = userDocs[3];

  // ── 2. BANK ACCOUNTS ─────────────────────────────────────────────────────
  console.log("🏦 Seeding bank accounts...");
  const bankDocs: any[] = [];
  const banksRaw = [
    { name: "Meezan Corporate Account",  bankName: "Meezan Bank Ltd",           accountNumber: "02010104958192", accountType: "current",  balance: 24500000, notes: "Primary operating account for billing & payroll" },
    { name: "HBL Project Escrow",        bankName: "Habib Bank Limited",        accountNumber: "50019283746501", accountType: "escrow",   balance: 48000000, notes: "Escrow for large commercial projects" },
    { name: "UBL Salary Account",        bankName: "United Bank Limited",       accountNumber: "1234500987654",  accountType: "current",  balance: 8200000,  notes: "Dedicated account for employee payroll" },
    { name: "MCB Petty Cash Account",    bankName: "MCB Bank Limited",          accountNumber: "9988001122334",  accountType: "savings",  balance: 3100000,  notes: "Site expenses and petty cash disbursements" },
  ];
  for (const b of banksRaw) {
    const r = await db.collection("bankaccounts").insertOne({ ...b, currency: "PKR", isActive: true, createdAt: now(), updatedAt: now() });
    bankDocs.push({ ...b, _id: r.insertedId });
  }
  const meezanBank = bankDocs[0], hblBank = bankDocs[1], ublBank = bankDocs[2], mcbBank = bankDocs[3];

  // ── 3. CLIENTS ───────────────────────────────────────────────────────────
  console.log("🏢 Seeding clients...");
  const clientsRaw = [
    { name: "Bahria Town Pvt Ltd",           contactPerson: "Malik Riaz Ahmed",    phone: "+92 51 111 786 111", email: "info@bahriatown.com.pk",         address: "Phase 8, Bahria Town, Rawalpindi",        taxId: "NTN-3891029-4", notes: "Premier real estate developer, multiple ongoing contracts" },
    { name: "Emaar Pakistan",                contactPerson: "Sohail Baig",         phone: "+92 21 111 362 277", email: "customercare@emaar.pk",           address: "Crescent Bay, DHA Phase 8, Karachi",      taxId: "NTN-1928374-1", notes: "Luxury beachfront and high-rise developments" },
    { name: "DHA Lahore",                    contactPerson: "Brig. Tariq Saleem",  phone: "+92 42 111 342 278", email: "info@dhalahore.org",              address: "DHA Head Office, Phase V, Lahore",        taxId: "NTN-0048271-3", notes: "Defence Housing Authority residential schemes" },
    { name: "Federal Works Division",        contactPerson: "Mr. Imtiaz Shah",     phone: "+92 51 920 2811",    email: "director@pwd.gov.pk",            address: "Ministry of Housing, G-5/2, Islamabad",   taxId: "NTN-0001122-7", notes: "Government infrastructure projects" },
    { name: "Packages Mall Management",      contactPerson: "Ali Hassan Raza",     phone: "+92 42 111 111 012", email: "info@packagesmall.com.pk",       address: "Walton Road, Lahore",                     taxId: "NTN-4412987-5", notes: "Commercial mall expansion and renovations" },
    { name: "Alhamra Arts Council",          contactPerson: "Dr. Zulfiqar Ali",    phone: "+92 42 3578 0425",   email: "info@alhamra.com.pk",            address: "The Mall, Lahore",                        taxId: "NTN-0098123-2", notes: "Cultural center expansion project" },
    { name: "Punjab Highway Authority",      contactPerson: "CE Muhammad Yousaf",  phone: "+92 42 9921 1717",   email: "pha@punjab.gov.pk",              address: "Aiwan-e-Iqbal, Lahore",                   taxId: "NTN-0023874-1", notes: "Road and bridge infrastructure authority" },
    { name: "MCB Bank Ltd",                  contactPerson: "Shoaib Mumtaz",       phone: "+92 42 3586 0801",   email: "headoffice@mcb.com.pk",          address: "MCB House, 15 Main Gulberg, Lahore",      taxId: "NTN-0009834-6", notes: "Corporate HQ renovation and branch fit-outs" },
    { name: "Pakistan State Oil",            contactPerson: "Khurram Farouk",      phone: "+92 21 111 117 117", email: "headoffice@pso.com.pk",          address: "PSO House, Khayaban-e-Iqbal, Karachi",    taxId: "NTN-0000028-3", notes: "Office block and fuel station constructions" },
    { name: "Lahore Development Authority",  contactPerson: "DG Muhammad Salim",   phone: "+92 42 9920 1601",   email: "dg@lda.gop.pk",                 address: "LDA Plaza, Egerton Road, Lahore",         taxId: "NTN-0013456-9", notes: "Housing schemes, parks, and civic projects" },
    { name: "Askari Housing Services",       contactPerson: "Col. Asif Mehmood",   phone: "+92 51 111 100 100", email: "info@askarihousing.com.pk",      address: "Askari-14, Rawalpindi Cantt",              taxId: "NTN-0039281-8", notes: "Military housing and commercial ventures" },
    { name: "DHA Karachi",                   contactPerson: "Rear Adm. Ahsan Ali", phone: "+92 21 3580 0100",   email: "info@dhakarachi.org",            address: "DHA Office, Phase VI, Karachi",           taxId: "NTN-0008733-2", notes: "Coastal residential towers and villas" },
    { name: "University of Engineering",     contactPerson: "Prof. Dr. Fazal Ahmad",phone:"+92 42 9029 2212",   email: "vc@uet.edu.pk",                 address: "UET Main Campus, G.T. Road, Lahore",      taxId: "NTN-0001987-5", notes: "Academic blocks and hostel expansion" },
    { name: "Serena Hotels Pakistan",        contactPerson: "GM Hassan Murtaza",   phone: "+92 51 287 7777",    email: "info@serena.com.pk",             address: "Khayaban-e-Suhrawardy, Islamabad",        taxId: "NTN-0071023-4", notes: "Hotel renovation and extension works" },
    { name: "Nespak Engineering",            contactPerson: "CEO Nadeem Baig",     phone: "+92 42 9923 0301",   email: "nespak@nespak.com.pk",           address: "7-C, Gulberg III, Lahore",                taxId: "NTN-0000444-1", notes: "Engineering consultancy partner and client" },
  ];
  const clientDocs: any[] = [];
  for (const c of clientsRaw) {
    const r = await db.collection("clients").insertOne({ ...c, isActive: true, createdAt: now(), updatedAt: now() });
    clientDocs.push({ ...c, _id: r.insertedId });
  }

  // ── 4. VENDORS ───────────────────────────────────────────────────────────
  console.log("🚚 Seeding vendors...");
  const vendorsRaw = [
    { name: "Bestway Cement Corp",        category: "materials",    contactPerson: "Tariq Mahmood",    phone: "+92 51 285 2401", email: "sales@bestway.com.pk",       address: "F-7 Markaz, Islamabad",          taxId: "NTN-0712938-9", notes: "Bulk cement supplier — OPC & SRC grades" },
    { name: "Mughal Steel Mills",          category: "materials",    contactPerson: "Khurram Mughal",   phone: "+92 42 359 6030", email: "info@mughalsteel.com",       address: "17-G, Gulberg II, Lahore",       taxId: "NTN-8271625-3", notes: "Deformed steel bars Grade 40 & 60" },
    { name: "Lucky Cement Ltd",            category: "materials",    contactPerson: "Bashir Paracha",   phone: "+92 21 111 786 111",email:"sales@lucky-cement.com",    address: "Korangi Creek Road, Karachi",    taxId: "NTN-0019834-7", notes: "Cement and aggregates, nationwide supply" },
    { name: "Master Group Pakistan",       category: "materials",    contactPerson: "Ijaz Saleem",      phone: "+92 42 111 627 837",email:"info@masterpvtltd.com",     address: "36-C, Gulberg III, Lahore",     taxId: "NTN-0388271-6", notes: "Tiles, marble, sanitary fittings" },
    { name: "Asia Bricks Industries",      category: "materials",    contactPerson: "Tariq Bashir",     phone: "+92 51 4871 002",  email: "info@asiabricks.pk",         address: "Industrial Estate, Hattar",     taxId: "NTN-0091823-5", notes: "Kiln bricks — Class A and B" },
    { name: "Siemens Pakistan Engineering",category: "electrical",   contactPerson: "Zubair Haider",    phone: "+92 21 111 743 637",email:"info@siemens.com.pk",       address: "The Forum, Clifton, Karachi",   taxId: "NTN-0001127-3", notes: "Electrical panels, transformers, cabling" },
    { name: "Tariq Glass Industries",      category: "materials",    contactPerson: "Faisal Tariq",     phone: "+92 42 3777 3300", email: "info@tariqglass.com.pk",     address: "Sundar Industrial Estate",      taxId: "NTN-0074521-8", notes: "Float glass, toughened glass, curtain walls" },
    { name: "Millat Equipment Rentals",    category: "equipment",    contactPerson: "Imran Sheikh",     phone: "+92 300 844 0011", email: "rentals@millat.com.pk",      address: "GT Road, Gujranwala",           taxId: "NTN-0028374-2", notes: "Heavy machinery rentals — cranes, loaders" },
    { name: "Pakistan Cables Ltd",         category: "electrical",   contactPerson: "Adnan Rauf",       phone: "+92 21 3245 2801", email: "info@pakcables.com.pk",      address: "SITE Area, Karachi",            taxId: "NTN-0000817-4", notes: "Power cables, wiring, switchgear" },
    { name: "Attock Cement Company",       category: "materials",    contactPerson: "Saeed Akbar",      phone: "+92 51 111 282 262",email:"cement@attock.com.pk",      address: "Attock House, F-6/1, Islamabad",taxId:"NTN-0000295-1", notes: "White and grey cement, specialized blends" },
    { name: "Punjab Plumbing Works",       category: "plumbing",     contactPerson: "Asif Malik",       phone: "+92 42 3571 0022", email: "ppw@gmail.com",              address: "Kot Lakhpat, Lahore",           taxId: "NTN-0192834-7", notes: "Plumbing, HVAC sub-contracting services" },
    { name: "Green Zone Landscaping",      category: "landscaping",  contactPerson: "Shahid Pervaiz",   phone: "+92 300 412 9983", email: "greenzone@pk.net",           address: "Johar Town, Lahore",            taxId: "NTN-0387612-3", notes: "Landscaping, irrigation, outdoor works" },
  ];
  const vendorDocs: any[] = [];
  for (const v of vendorsRaw) {
    const r = await db.collection("vendors").insertOne({ ...v, isActive: true, createdAt: now(), updatedAt: now() });
    vendorDocs.push({ ...v, _id: r.insertedId });
  }

  // ── 5. EMPLOYEES ─────────────────────────────────────────────────────────
  console.log("👷 Seeding employees...");
  const employeesRaw = [
    { name: "Engr. Hamza Ali",       role: "Senior Structural Engineer",  department: "Engineering",  phone: "+92 300 5551234", email: "hamza.ali@constructionlatech.com",      salary: 280000, salaryType: "monthly", joiningDate: new Date("2022-03-15") },
    { name: "Usman Ghani",           role: "Site Supervisor",             department: "Operations",   phone: "+92 321 4449876", email: "usman.ghani@constructionlatech.com",    salary: 130000, salaryType: "monthly", joiningDate: new Date("2023-01-10") },
    { name: "Engr. Sadia Iqbal",     role: "Civil Engineer",              department: "Engineering",  phone: "+92 333 7891234", email: "sadia.iqbal@constructionlatech.com",    salary: 220000, salaryType: "monthly", joiningDate: new Date("2022-08-01") },
    { name: "Muhammad Asif",         role: "Quantity Surveyor",           department: "Estimation",   phone: "+92 311 2340987", email: "m.asif@constructionlatech.com",         salary: 180000, salaryType: "monthly", joiningDate: new Date("2023-04-20") },
    { name: "Engr. Tariq Hussain",   role: "MEP Engineer",                department: "Engineering",  phone: "+92 345 8762901", email: "tariq.h@constructionlatech.com",        salary: 240000, salaryType: "monthly", joiningDate: new Date("2021-11-01") },
    { name: "Rashid Mehmood",        role: "Mason Foreman",               department: "Operations",   phone: "+92 300 1231230", email: "rashid.m@constructionlatech.com",       salary: 90000,  salaryType: "monthly", joiningDate: new Date("2020-06-15") },
    { name: "Ali Hassan",            role: "Electrician",                 department: "Electrical",   phone: "+92 333 6541234", email: "ali.h@constructionlatech.com",          salary: 75000,  salaryType: "monthly", joiningDate: new Date("2021-09-01") },
    { name: "Nasreen Bibi",          role: "HR Manager",                  department: "HR",           phone: "+92 311 9871234", email: "nasreen.b@constructionlatech.com",      salary: 160000, salaryType: "monthly", joiningDate: new Date("2022-02-14") },
    { name: "Khurram Shahzad",       role: "Safety Officer",              department: "HSE",          phone: "+92 345 3210987", email: "khurram.s@constructionlatech.com",      salary: 120000, salaryType: "monthly", joiningDate: new Date("2023-06-01") },
    { name: "Zara Malik",            role: "Architect",                   department: "Design",       phone: "+92 321 7654321", email: "zara.m@constructionlatech.com",         salary: 200000, salaryType: "monthly", joiningDate: new Date("2022-10-15") },
    { name: "Engr. Farhan Butt",     role: "Site Engineer",               department: "Engineering",  phone: "+92 300 1122334", email: "farhan.b@constructionlatech.com",       salary: 175000, salaryType: "monthly", joiningDate: new Date("2023-09-01") },
    { name: "Waheed Anjum",          role: "Plumber Foreman",             department: "Plumbing",     phone: "+92 311 4455667", email: "waheed.a@constructionlatech.com",       salary: 85000,  salaryType: "monthly", joiningDate: new Date("2021-03-20") },
    { name: "Yasir Latif",           role: "Welder",                      department: "Fabrication",  phone: "+92 333 7788990", email: "yasir.l@constructionlatech.com",        salary: 70000,  salaryType: "monthly", joiningDate: new Date("2022-07-01") },
    { name: "Bushra Ameen",          role: "Interior Designer",           department: "Design",       phone: "+92 345 1122334", email: "bushra.a@constructionlatech.com",       salary: 170000, salaryType: "monthly", joiningDate: new Date("2024-01-15") },
    { name: "Adnan Riaz",            role: "Equipment Operator",          department: "Operations",   phone: "+92 300 9988776", email: "adnan.r@constructionlatech.com",        salary: 95000,  salaryType: "monthly", joiningDate: new Date("2021-05-10") },
    { name: "Hina Shafiq",           role: "Procurement Officer",         department: "Procurement",  phone: "+92 321 6655443", email: "hina.s@constructionlatech.com",         salary: 140000, salaryType: "monthly", joiningDate: new Date("2023-03-01") },
    { name: "Saad Mehmood",          role: "Laborer Supervisor",          department: "Operations",   phone: "+92 311 3344556", email: "saad.m@constructionlatech.com",         salary: 80000,  salaryType: "monthly", joiningDate: new Date("2020-11-01") },
    { name: "Aisha Siddiqui",        role: "Document Controller",         department: "Admin",        phone: "+92 333 1122000", email: "aisha.s@constructionlatech.com",        salary: 110000, salaryType: "monthly", joiningDate: new Date("2024-03-10") },
    { name: "Fahad Mirza",           role: "Crane Operator",              department: "Operations",   phone: "+92 345 8899001", email: "fahad.m@constructionlatech.com",        salary: 100000, salaryType: "monthly", joiningDate: new Date("2022-04-01") },
    { name: "Engr. Sana Akhtar",     role: "Environmental Engineer",      department: "HSE",          phone: "+92 300 7722334", email: "sana.a@constructionlatech.com",         salary: 190000, salaryType: "monthly", joiningDate: new Date("2023-07-15") },
    { name: "Imran Zahid",           role: "Carpenter Foreman",           department: "Operations",   phone: "+92 321 5544332", email: "imran.z@constructionlatech.com",        salary: 82000,  salaryType: "monthly", joiningDate: new Date("2021-08-20") },
    { name: "Rabia Farooq",          role: "Cost Estimator",              department: "Estimation",   phone: "+92 311 2233445", email: "rabia.f@constructionlatech.com",        salary: 155000, salaryType: "monthly", joiningDate: new Date("2023-11-01") },
    { name: "Shahzaib Khan",         role: "Scaffolding Supervisor",      department: "Operations",   phone: "+92 333 6677889", email: "shahzaib.k@constructionlatech.com",     salary: 88000,  salaryType: "monthly", joiningDate: new Date("2022-01-15") },
    { name: "Fariha Naz",            role: "Electrical Engineer",         department: "Electrical",   phone: "+92 345 4433221", email: "fariha.n@constructionlatech.com",       salary: 215000, salaryType: "monthly", joiningDate: new Date("2022-06-01") },
    { name: "Naeem Akhtar",          role: "Senior Mason",                department: "Operations",   phone: "+92 300 8877665", email: "naeem.a@constructionlatech.com",        salary: 78000,  salaryType: "monthly", joiningDate: new Date("2020-03-10") },
  ];
  const empDocs: any[] = [];
  for (const e of employeesRaw) {
    const r = await db.collection("employees").insertOne({ ...e, isActive: true, createdAt: now(), updatedAt: now() });
    empDocs.push({ ...e, _id: r.insertedId });
  }

  // ── 6. EQUIPMENT ─────────────────────────────────────────────────────────
  console.log("🚜 Seeding equipment...");
  const equipmentRaw = [
    { name: "CAT 320 Hydraulic Excavator",      category: "heavy_machinery", model: "CAT-320D",      serialNumber: "CAT-EXC-2023-991", status: "available",        hourlyRate: 8500,  purchaseDate: new Date("2021-06-20"), purchasePrice: 28000000, notes: "Serviced May 2026" },
    { name: "Liebherr 280 Tower Crane",         category: "cranes",          model: "280 EC-H 12",   serialNumber: "LBH-CRN-8820",     status: "in_use",           hourlyRate: 15000, purchaseDate: new Date("2020-11-12"), purchasePrice: 45000000, notes: "Deployed at Gulberg Commercial Heights" },
    { name: "CIFA 52 Concrete Pump",            category: "concrete",        model: "CIFA K52L",     serialNumber: "CIFA-PMP-0192",    status: "available",        hourlyRate: 6500,  purchaseDate: new Date("2022-03-10"), purchasePrice: 18000000, notes: "Long boom pump for high-rise work" },
    { name: "JCB 3CX Backhoe Loader",           category: "heavy_machinery", model: "3CX Super",     serialNumber: "JCB-BCK-44120",    status: "in_use",           hourlyRate: 4500,  purchaseDate: new Date("2020-05-01"), purchasePrice: 9500000,  notes: "Assigned to LDA Housing Scheme" },
    { name: "Wirtgen W 200 Road Milling Machine",category:"road_works",      model: "W200",          serialNumber: "WRT-MIL-2291",     status: "maintenance",      hourlyRate: 12000, purchaseDate: new Date("2019-08-14"), purchasePrice: 32000000, notes: "Annual service in progress" },
    { name: "ZOOMLION QY25 Mobile Crane",       category: "cranes",          model: "QY25V532",      serialNumber: "ZML-CRN-3318",     status: "available",        hourlyRate: 9000,  purchaseDate: new Date("2021-02-20"), purchasePrice: 22000000, notes: "25-ton capacity, outrigger-mounted" },
    { name: "Atlas Copco Drill Rig",            category: "drilling",        model: "DM45",          serialNumber: "ATC-DRL-0099",     status: "available",        hourlyRate: 11000, purchaseDate: new Date("2023-01-05"), purchasePrice: 38000000, notes: "Rotary drill for deep pile foundations" },
    { name: "CAT D6 Bulldozer",                 category: "heavy_machinery", model: "D6N XL",        serialNumber: "CAT-BLD-8871",     status: "in_use",           hourlyRate: 7000,  purchaseDate: new Date("2022-07-15"), purchasePrice: 25000000, notes: "Grading work at DHA Phase 9" },
    { name: "Hamm 3414 Vibratory Compactor",    category: "compaction",      model: "3414 P",        serialNumber: "HAM-CMP-5502",     status: "available",        hourlyRate: 3500,  purchaseDate: new Date("2021-09-30"), purchasePrice: 7500000,  notes: "Suitable for sub-base and base layers" },
    { name: "MAN 6x4 Tipper Truck (x2)",        category: "transport",       model: "TGS 26.440",    serialNumber: "MAN-TIP-0081",     status: "available",        hourlyRate: 2500,  purchaseDate: new Date("2020-12-01"), purchasePrice: 12000000, notes: "Material haulage — capacity 20 ton" },
    { name: "Schwing Stetter 8m³ Transit Mixer", category: "concrete",       model: "S 8 SL",        serialNumber: "SCH-MXR-1182",     status: "in_use",           hourlyRate: 4000,  purchaseDate: new Date("2022-10-10"), purchasePrice: 8500000,  notes: "Ready-mix concrete delivery" },
    { name: "Cummins 500 KVA Generator",        category: "power",           model: "C500D5",        serialNumber: "CMN-GEN-2234",     status: "available",        hourlyRate: 1800,  purchaseDate: new Date("2023-03-18"), purchasePrice: 5500000,  notes: "Backup power for site offices" },
  ];
  const eqDocs: any[] = [];
  for (const e of equipmentRaw) {
    const r = await db.collection("equipment").insertOne({ ...e, isActive: true, createdAt: now(), updatedAt: now() });
    eqDocs.push({ ...e, _id: r.insertedId });
  }

  // ── 7. PROJECTS ──────────────────────────────────────────────────────────
  console.log("🏗️  Seeding 22 projects...");
  const projectsRaw = [
    { name: "Gulberg Commercial Heights",         location: "Main Blvd, Gulberg III, Lahore",          description: "Multi-story luxury commercial complex with high-end retail and corporate offices.",        type: "commercial",   client: clientDocs[0],  manager: managers[0], budget: 185000000, pct: 45, status: "in_progress", start: monthsAgo(9),  end: monthsFromNow(15) },
    { name: "Crescent Bay Luxury Villas",         location: "DHA Phase 8, Karachi",                    description: "Exclusive sea-facing residential villa construction with premium interior finish.",         type: "residential",  client: clientDocs[1],  manager: managers[1], budget: 220000000, pct: 20, status: "in_progress", start: monthsAgo(5),  end: monthsFromNow(20) },
    { name: "DHA Phase 9 Road Network",           location: "DHA Phase 9, Lahore",                     description: "Complete road network, drainage, and utilities for new residential phase.",                 type: "renovation",   client: clientDocs[2],  manager: managers[2], budget: 95000000,  pct: 62, status: "in_progress", start: monthsAgo(12), end: monthsFromNow(4)  },
    { name: "Federal Judicial Complex",           location: "F-8/4, Islamabad",                        description: "Modern judicial complex with courtrooms, offices, and supporting facilities.",              type: "commercial",   client: clientDocs[3],  manager: managers[0], budget: 320000000, pct: 5,  status: "planning",    start: daysFromNow(30),end: monthsFromNow(30)},
    { name: "Packages Mall Phase 2 Extension",    location: "Walton Road, Lahore",                     description: "Extension of existing shopping mall — new food court, cinema, and anchor stores.",         type: "commercial",   client: clientDocs[4],  manager: managers[1], budget: 150000000, pct: 35, status: "in_progress", start: monthsAgo(6),  end: monthsFromNow(12) },
    { name: "Alhamra Cultural Center Expansion",  location: "The Mall, Lahore",                        description: "New performing arts wing with auditorium, galleries, and workshops.",                      type: "commercial",   client: clientDocs[5],  manager: managers[2], budget: 65000000,  pct: 15, status: "on_hold",     start: monthsAgo(4),  end: monthsFromNow(18) },
    { name: "Punjab Motorway Bridge M-2",         location: "Sheikhupura, Punjab",                     description: "Steel-concrete composite bridge — 4-lane, 320m span over Ravi River.",                    type: "renovation",   client: clientDocs[6],  manager: managers[0], budget: 275000000, pct: 70, status: "in_progress", start: monthsAgo(18), end: monthsFromNow(3)  },
    { name: "MCB Bank HQ Renovation",             location: "15 Main Gulberg, Lahore",                 description: "Full interior renovation, MEP overhaul, and façade upgrade of 22-story HQ building.",     type: "renovation",   client: clientDocs[7],  manager: managers[1], budget: 48000000,  pct: 100,status: "completed",  start: monthsAgo(14), end: monthsAgo(2)      },
    { name: "PSO Corporate Office Block",         location: "Khayaban-e-Iqbal, Karachi",               description: "New 8-story office block for PSO HQ expansion.",                                          type: "commercial",   client: clientDocs[8],  manager: managers[2], budget: 130000000, pct: 55, status: "in_progress", start: monthsAgo(10), end: monthsFromNow(8)  },
    { name: "LDA Housing Scheme Block A",         location: "Johar Town, Lahore",                      description: "Affordable residential housing blocks — 200 units with all civic amenities.",              type: "residential",  client: clientDocs[9],  manager: managers[0], budget: 175000000, pct: 30, status: "in_progress", start: monthsAgo(7),  end: monthsFromNow(17) },
    { name: "Askari Villas Phase 3",              location: "Askari-14, Rawalpindi Cantt",              description: "Luxury residential villas with basement, ground, and first floor.",                        type: "residential",  client: clientDocs[10], manager: managers[1], budget: 92000000,  pct: 100,status: "completed",  start: monthsAgo(20), end: monthsAgo(1)      },
    { name: "DHA Karachi Waterfront Tower",       location: "Phase VI, DHA Karachi",                   description: "40-story residential tower with sea-view apartments.",                                     type: "residential",  client: clientDocs[11], manager: managers[2], budget: 480000000, pct: 3,  status: "planning",    start: daysFromNow(60),end: monthsFromNow(42)},
    { name: "UET Engineering Block",              location: "GT Road, Lahore",                          description: "New 6-story faculty block with labs, lecture halls, and admin offices.",                   type: "commercial",   client: clientDocs[12], manager: managers[0], budget: 78000000,  pct: 25, status: "in_progress", start: monthsAgo(5),  end: monthsFromNow(14) },
    { name: "Serena Hotel Islamabad Renovation",  location: "Khayaban-e-Suhrawardy, Islamabad",        description: "Full renovation of 200-room hotel — rooms, lobby, restaurant, and pool area.",            type: "renovation",   client: clientDocs[13], manager: managers[1], budget: 55000000,  pct: 100,status: "completed",  start: monthsAgo(16), end: monthsAgo(3)      },
    { name: "Bahria Heights Tower B",             location: "Bahria Town Phase 7, Rawalpindi",         description: "25-story residential tower — 120 apartments, gym, swimming pool, rooftop.",               type: "residential",  client: clientDocs[0],  manager: managers[2], budget: 240000000, pct: 50, status: "in_progress", start: monthsAgo(11), end: monthsFromNow(13) },
    { name: "Lahore Ring Road Interchange",       location: "Sundar Industrial Area, Lahore",          description: "Cloverleaf interchange at Ring Road and GT Road junction.",                               type: "renovation",   client: clientDocs[6],  manager: managers[0], budget: 195000000, pct: 40, status: "on_hold",     start: monthsAgo(9),  end: monthsFromNow(9)  },
    { name: "Gulberg Residencia Villas",          location: "Canal Bank Road, Lahore",                 description: "50-unit premium residential villa complex with landscape and clubhouse.",                   type: "residential",  client: clientDocs[0],  manager: managers[1], budget: 160000000, pct: 65, status: "in_progress", start: monthsAgo(15), end: monthsFromNow(5)  },
    { name: "Packages Industrial Warehouse",      location: "Sundar Industrial Estate, Lahore",        description: "50,000 sqft climate-controlled warehouse with loading docks and office block.",            type: "industrial",   client: clientDocs[4],  manager: managers[2], budget: 68000000,  pct: 8,  status: "planning",    start: daysFromNow(45),end: monthsFromNow(14)},
    { name: "Federal Government Hospital",        location: "H-8/4, Islamabad",                        description: "300-bed government hospital with OPD, ICU, operation theaters, and pharmacy.",            type: "commercial",   client: clientDocs[3],  manager: managers[0], budget: 395000000, pct: 22, status: "in_progress", start: monthsAgo(8),  end: monthsFromNow(22) },
    { name: "Nespak Head Office Complex",         location: "7-C, Gulberg III, Lahore",                description: "Corporate campus with main office tower, conference center, and parking.",                 type: "commercial",   client: clientDocs[14], manager: managers[1], budget: 112000000, pct: 100,status: "completed",  start: monthsAgo(24), end: monthsAgo(4)      },
    { name: "Askari Commercial Center",           location: "Askari 11, Lahore Cantt",                 description: "4-story commercial center with retail, food court, and rooftop events space.",             type: "commercial",   client: clientDocs[10], manager: managers[2], budget: 85000000,  pct: 48, status: "in_progress", start: monthsAgo(8),  end: monthsFromNow(8)  },
    { name: "LDA Green Zone Park & Amphitheatre", location: "Lake Road, Lahore",                       description: "Public park with amphitheatre, jogging tracks, fountain, and cafeteria.",                 type: "renovation",   client: clientDocs[9],  manager: managers[0], budget: 42000000,  pct: 0,  status: "planning",    start: daysFromNow(20),end: monthsFromNow(10)},
  ];
  const projectDocs: any[] = [];
  for (const p of projectsRaw) {
    const r = await db.collection("projects").insertOne({
      name: p.name, location: p.location, description: p.description,
      type: p.type, clientId: p.client._id, assignedManagerId: p.manager._id,
      budget: p.budget, completionPercent: p.pct, status: p.status,
      startDate: p.start, endDate: p.end,
      createdById: admin._id, createdAt: now(), updatedAt: now(),
    });
    projectDocs.push({ ...p, _id: r.insertedId });
  }

  // ── 8. PROJECT PHASES ────────────────────────────────────────────────────
  console.log("📅 Seeding project phases...");
  const phaseTemplates = [
    ["Mobilisation & Site Setup",     "Site clearing, hoarding, temporary offices and utility connections.",        "completed"],
    ["Substructure & Foundation",     "Piling, raft/pad foundations, and basement slab construction.",             "completed"],
    ["Superstructure",                "Column, beam and slab casting up to roof level.",                          "in_progress"],
    ["Finishing & MEP",               "Brick masonry, plastering, tiling, electrical, plumbing and HVAC works.", "pending"],
  ];
  const phaseDocs: any[] = [];
  for (const proj of projectDocs) {
    for (let i = 0; i < 4; i++) {
      const [pName, pDesc, pStatus] = phaseTemplates[i];
      const st = proj.status === "planning" ? "pending" : i < 2 ? "completed" : proj.status === "completed" ? "completed" : i === 2 ? "in_progress" : "pending";
      const r = await db.collection("projectphases").insertOne({
        projectId: proj._id, name: pName, description: pDesc,
        startDate: proj.start, endDate: proj.end,
        status: st, order: i + 1, createdAt: now(), updatedAt: now(),
      });
      phaseDocs.push({ _id: r.insertedId, projectId: proj._id, order: i });
    }
  }

  // ── 9. MILESTONES ────────────────────────────────────────────────────────
  console.log("🚩 Seeding milestones...");
  const milestoneNames = [
    ["Foundation Complete",      "Full foundation system signed off by structural engineer",       true],
    ["Ground Floor Slab Cast",   "Structural ground floor slab concrete pour complete",            true],
    ["Structure at Roof Level",  "Column and beam work completed to roof level",                  false],
    ["Brick Masonry Complete",   "All brick partition walls and external masonry finished",        false],
    ["Handover to Client",       "Project punch list cleared, official handover completed",        false],
  ];
  for (const proj of projectDocs) {
    for (let i = 0; i < 5; i++) {
      const [mTitle, mDesc, done] = milestoneNames[i];
      const isDone = proj.pct === 100 || (proj.pct > 50 && i < 3) || (proj.pct > 20 && i < 2);
      await db.collection("milestones").insertOne({
        projectId: proj._id,
        title: mTitle, description: mDesc,
        dueDate: daysFromNow(rand(-60, 120)),
        status: isDone ? "completed" : proj.status === "planning" ? "pending" : i === 2 ? "in_progress" : "pending",
        completedAt: isDone ? daysAgo(rand(5, 30)) : null,
        createdAt: now(), updatedAt: now(),
      });
    }
  }

  // ── 10. TASKS ────────────────────────────────────────────────────────────
  console.log("✅ Seeding tasks...");
  const taskTitles = [
    ["Soil investigation and geotechnical report",      "high",    "completed"],
    ["Structural drawings approval from consultant",    "high",    "completed"],
    ["Procurement of cement and aggregate",             "high",    "in_progress"],
    ["Steel rebar placement for columns",               "high",    "in_progress"],
    ["Concrete pour for floor slab",                   "medium",  "todo"],
    ["Install electrical conduit and first fix",        "medium",  "todo"],
    ["Brick masonry for partition walls",               "medium",  "todo"],
    ["Plumbing first fix and testing",                  "medium",  "todo"],
    ["External façade and cladding works",             "low",     "todo"],
    ["Final inspection and punch list clearance",       "low",     "todo"],
  ];
  for (const proj of projectDocs) {
    const assignableEmps = empDocs.slice(0, 15);
    for (let i = 0; i < 8; i++) {
      const [tTitle, tPriority, tStatus] = taskTitles[i];
      const isDone = proj.pct === 100 || (proj.pct > 60 && i < 4) || (proj.pct > 30 && i < 2);
      await db.collection("tasks").insertOne({
        projectId: proj._id,
        title: tTitle, description: `${tTitle} for ${proj.name}`,
        assignedToId: pick(assignableEmps)._id,
        priority: tPriority,
        status: isDone ? "completed" : proj.status === "planning" ? "todo" : tStatus,
        dueDate: daysFromNow(rand(-30, 90)),
        completedAt: isDone ? daysAgo(rand(1, 20)) : null,
        createdAt: now(), updatedAt: now(),
      });
    }
  }

  // ── 11. PROJECT EMPLOYEES & EQUIPMENT ────────────────────────────────────
  console.log("🔗 Seeding project assignments...");
  const activeProjects = projectDocs.filter(p => p.status !== "planning");
  for (const proj of activeProjects) {
    const assignedEmps = empDocs.sort(() => 0.5 - Math.random()).slice(0, rand(3, 6));
    for (const emp of assignedEmps) {
      await db.collection("projectemployees").insertOne({
        projectId: proj._id, employeeId: emp._id,
        roleOnProject: emp.role, assignedAt: proj.start,
        createdAt: now(), updatedAt: now(),
      });
    }
    const assignedEqs = eqDocs.sort(() => 0.5 - Math.random()).slice(0, rand(1, 3));
    for (const eq of assignedEqs) {
      await db.collection("projectequipments").insertOne({
        projectId: proj._id, equipmentId: eq._id,
        assignedAt: proj.start, createdAt: now(), updatedAt: now(),
      });
    }
  }

  // ── 12. MATERIALS ────────────────────────────────────────────────────────
  console.log("📦 Seeding materials...");
  const materialTemplates = [
    { itemName: "Portland Cement (OPC 53 Grade)", category: "cement",     unit: "bags",  unitPrice: 850,    qty: 2000, minStock: 200 },
    { itemName: "Deformed Steel Bars (Grade 60)", category: "steel",      unit: "ton",   unitPrice: 275000, qty: 80,   minStock: 10  },
    { itemName: "Class A Burnt Bricks",           category: "bricks",     unit: "pcs",   unitPrice: 13,     qty: 50000,minStock: 5000},
    { itemName: "Coarse Aggregate 3/4\"",         category: "aggregate",  unit: "cft",   unitPrice: 180,    qty: 3000, minStock: 500 },
    { itemName: "River Sand (Fine)",              category: "aggregate",  unit: "cft",   unitPrice: 120,    qty: 2500, minStock: 400 },
    { itemName: "Ceramic Floor Tiles (600x600)",  category: "tiles",      unit: "sqft",  unitPrice: 180,    qty: 5000, minStock: 500 },
    { itemName: "Aluminium Window Frames",        category: "joinery",    unit: "sqft",  unitPrice: 750,    qty: 1200, minStock: 100 },
    { itemName: "Electrical PVC Conduit (25mm)",  category: "electrical", unit: "mtr",   unitPrice: 85,     qty: 3000, minStock: 300 },
    { itemName: "uPVC Water Supply Pipes (1\")",  category: "plumbing",   unit: "mtr",   unitPrice: 120,    qty: 2000, minStock: 200 },
    { itemName: "Timber Shuttering Planks",       category: "timber",     unit: "cft",   unitPrice: 1800,   qty: 500,  minStock: 50  },
  ];
  const materialDocs: any[] = [];
  for (const proj of projectDocs.filter(p => p.status !== "planning")) {
    const projMaterials = materialTemplates.sort(() => 0.5 - Math.random()).slice(0, rand(5, 8));
    for (const m of projMaterials) {
      const used = Math.floor(m.qty * (proj.pct / 100));
      const stockQty = m.qty - used;
      const totalPrice = m.qty * m.unitPrice;
      const r = await db.collection("materials").insertOne({
        itemName: m.itemName, category: m.category, unit: m.unit,
        unitPrice: m.unitPrice, quantity: m.qty,
        stockQuantity: stockQty, minStockLevel: m.minStock,
        totalPrice, receivedDate: proj.start,
        projectId: proj._id, vendorId: pick(vendorDocs)._id,
        createdAt: now(), updatedAt: now(),
      });
      materialDocs.push({ _id: r.insertedId, ...m, stockQty, projectId: proj._id });
    }
  }

  // Material usage logs
  for (const mat of materialDocs.slice(0, 40)) {
    const usedQty = Math.floor(rand(10, 50));
    if (usedQty > 0) {
      await db.collection("materialusages").insertOne({
        materialId: mat._id, projectId: mat.projectId,
        quantityUsed: usedQty,
        purpose: pick(["Foundation pour", "Column casting", "Slab construction", "Masonry works", "Finishing works"]),
        date: daysAgo(rand(1, 60)), usedById: pick(empDocs)._id,
        createdAt: now(),
      });
    }
  }

  // ── 13. INVOICES ─────────────────────────────────────────────────────────
  console.log("💵 Seeding invoices...");
  const invStatuses = ["paid", "paid", "sent", "overdue", "draft"];
  let invNum = 1;
  const invoiceDocs: any[] = [];
  for (const proj of projectDocs) {
    const numInv = proj.status === "planning" ? 0 : proj.pct === 100 ? 4 : rand(2, 3);
    for (let i = 0; i < numInv; i++) {
      const st = proj.pct === 100 ? "paid" : pick(invStatuses);
      const subtotal = Math.round(proj.budget * rand(10, 25) / 100 / 100) * 100;
      const taxPct = 16;
      const taxAmt = Math.round(subtotal * taxPct / 100);
      const grandTotal = subtotal + taxAmt;
      const issueDate = daysAgo(rand(10, 120));
      const dueDate = new Date(issueDate); dueDate.setDate(dueDate.getDate() + 30);
      const r = await db.collection("invoices").insertOne({
        invoiceNumber: `INV-2026-${String(invNum++).padStart(3, "0")}`,
        projectId: proj._id, clientId: proj.client._id,
        issueDate, dueDate,
        paidAt: st === "paid" ? daysAgo(rand(1, 20)) : null,
        status: st,
        subtotal, taxPercent: taxPct, taxAmount: taxAmt, grandTotal,
        paymentTerms: "30 days net",
        notes: `Milestone billing #${i + 1} — ${proj.name}`,
        createdById: accountant._id,
        items: [
          { description: `Civil works progress — ${proj.name} (Milestone ${i + 1})`, quantity: 1, unit: "job", unitPrice: Math.round(subtotal * 0.7), total: Math.round(subtotal * 0.7) },
          { description: "Labour and supervision charges",                             quantity: 1, unit: "job", unitPrice: Math.round(subtotal * 0.3), total: Math.round(subtotal * 0.3) },
        ],
        createdAt: now(), updatedAt: now(),
      });
      invoiceDocs.push({ _id: r.insertedId, status: st, grandTotal, projectId: proj._id, clientId: proj.client._id });
    }
  }

  // ── 14. LEDGER ENTRIES ───────────────────────────────────────────────────
  console.log("📊 Seeding ledger entries...");
  // Income from paid invoices
  for (const inv of invoiceDocs.filter(i => i.status === "paid")) {
    await db.collection("ledgerentries").insertOne({
      date: daysAgo(rand(1, 60)), type: "income", category: "client_payment",
      projectId: inv.projectId, bankAccountId: pick([meezanBank, hblBank])._id,
      amount: inv.grandTotal,
      description: `Payment received for project billing`,
      paymentMode: pick(["bank_transfer", "cheque", "online"]),
      partyType: "client", referenceNumber: `FT-${rand(100000, 999999)}`,
      createdById: accountant._id, createdAt: now(), updatedAt: now(),
    });
  }
  // Material expenses
  const materialExpenses = [
    { desc: "Procurement: Portland Cement 3000 bags",      amount: 2550000, cat: "material_purchase", vendor: vendorDocs[0] },
    { desc: "Procurement: Steel Bars Grade 60 — 50 ton",   amount: 13750000,cat: "material_purchase", vendor: vendorDocs[1] },
    { desc: "Procurement: Class A Bricks 80,000 pcs",      amount: 1040000, cat: "material_purchase", vendor: vendorDocs[4] },
    { desc: "Procurement: Aggregate & River Sand",          amount: 980000,  cat: "material_purchase", vendor: vendorDocs[2] },
    { desc: "Procurement: Floor Tiles 3000 sqft",          amount: 540000,  cat: "material_purchase", vendor: vendorDocs[3] },
    { desc: "Procurement: Electrical Cables & Conduit",    amount: 1200000, cat: "material_purchase", vendor: vendorDocs[5] },
    { desc: "Procurement: uPVC Plumbing Pipes & Fittings", amount: 680000,  cat: "material_purchase", vendor: vendorDocs[10] },
    { desc: "Procurement: Timber Shuttering Planks",       amount: 750000,  cat: "material_purchase", vendor: vendorDocs[7] },
    { desc: "Procurement: Cement (Restock) 2000 bags",     amount: 1700000, cat: "material_purchase", vendor: vendorDocs[9] },
    { desc: "Procurement: Glass — Curtain Wall System",    amount: 3200000, cat: "material_purchase", vendor: vendorDocs[6] },
  ];
  for (const exp of materialExpenses) {
    await db.collection("ledgerentries").insertOne({
      date: daysAgo(rand(5, 90)), type: "expense", category: exp.cat,
      projectId: pick(activeProjects)._id, bankAccountId: pick([meezanBank, mcbBank])._id,
      vendorId: exp.vendor._id, amount: exp.amount,
      description: exp.desc, paymentMode: pick(["bank_transfer", "cheque"]),
      partyType: "vendor", referenceNumber: `PO-${rand(10000, 99999)}`,
      createdById: accountant._id, createdAt: now(), updatedAt: now(),
    });
  }
  // Salary expenses
  const months = ["January", "February", "March", "April", "May", "June"];
  for (const month of months) {
    const totalSalary = empDocs.reduce((s, e) => s + e.salary, 0);
    await db.collection("ledgerentries").insertOne({
      date: daysAgo(rand(1, 180)), type: "expense", category: "salary",
      bankAccountId: ublBank._id, amount: totalSalary,
      description: `Employee payroll disbursement — ${month} 2026`,
      paymentMode: "bank_transfer", partyType: "employee",
      referenceNumber: `SAL-2026-${month.slice(0, 3).toUpperCase()}`,
      createdById: accountant._id, createdAt: now(), updatedAt: now(),
    });
  }
  // Other expenses
  const otherExpenses = [
    { desc: "Equipment maintenance — CAT Excavator service",  amount: 185000,  cat: "equipment_maintenance" },
    { desc: "Site safety equipment — helmets, harnesses",     amount: 220000,  cat: "safety" },
    { desc: "Site office rent — Gulberg site",                amount: 75000,   cat: "rent" },
    { desc: "Utility bills — LESCO June 2026",                amount: 142000,  cat: "utilities" },
    { desc: "Fuel for generators and vehicles",               amount: 380000,  cat: "fuel" },
    { desc: "Sub-contractor payment — Plumbing works",        amount: 1850000, cat: "subcontractor" },
    { desc: "Sub-contractor payment — Electrical first fix",  amount: 2100000, cat: "subcontractor" },
    { desc: "Insurance premium — project liability",          amount: 540000,  cat: "insurance" },
    { desc: "Professional fees — Structural consultant",      amount: 850000,  cat: "professional_fees" },
    { desc: "Permits and NOC fees — LDA",                     amount: 320000,  cat: "permits" },
    { desc: "Transportation and site logistics",              amount: 460000,  cat: "transport" },
    { desc: "Office supplies and stationery",                 amount: 48000,   cat: "admin" },
  ];
  for (const e of otherExpenses) {
    await db.collection("ledgerentries").insertOne({
      date: daysAgo(rand(1, 120)), type: "expense", category: e.cat,
      projectId: pick(activeProjects)._id, bankAccountId: pick([meezanBank, mcbBank])._id,
      amount: e.amount, description: e.desc,
      paymentMode: pick(["bank_transfer", "cheque", "cash"]),
      createdById: accountant._id, createdAt: now(), updatedAt: now(),
    });
  }

  // ── 15. CONTRACTS ────────────────────────────────────────────────────────
  console.log("📋 Seeding contracts...");
  const contractStatuses = ["active", "active", "active", "completed", "on_hold"];
  let contractNum = 1;
  for (const proj of projectDocs.filter(p => p.status !== "planning").slice(0, 15)) {
    await db.collection("contracts").insertOne({
      contractNumber: `LATECH-${2026}-${String(contractNum++).padStart(3, "0")}`,
      title: `Construction Contract — ${proj.name}`,
      clientId: proj.client._id,
      scope: `Full construction works for ${proj.name} including civil, structural, MEP, and finishing works as per BOQ and approved drawings.`,
      contractValue: proj.budget,
      startDate: proj.start, endDate: proj.end,
      status: proj.status === "completed" ? "completed" : pick(contractStatuses),
      paymentTerms: "Monthly progressive billing against certified work. Retention: 5% up to practical completion.",
      notes: `Contract awarded after competitive tendering. All works to comply with NESPAK / consultant specifications.`,
      createdById: admin._id, createdAt: now(), updatedAt: now(),
    });
  }

  // ── 15b. SUBCONTRACTS ────────────────────────────────────────────────────
  console.log("🤝 Seeding subcontracts...");
  const scopeTemplates = [
    "Electrical works — first and second fix, panel installation",
    "Plumbing and HVAC installation",
    "Structural steel fabrication and erection",
    "Aluminium and glazing works — curtain wall system",
    "Landscaping and external works",
    "Tiling and flooring works",
    "Painting and finishing works",
    "Fire fighting and fire alarm system installation",
  ];
  for (const proj of projectDocs.filter(p => p.status !== "planning")) {
    const numSc = rand(1, 3);
    const chosenVendors = vendorDocs.sort(() => 0.5 - Math.random()).slice(0, numSc);
    for (const vendor of chosenVendors) {
      const contractValue = Math.round(proj.budget * rand(3, 12) / 100 / 1000) * 1000;
      const isCompleted = proj.pct === 100 || (proj.pct > 55 && Math.random() > 0.5);
      await db.collection("subcontracts").insertOne({
        projectId: proj._id, vendorId: vendor._id,
        contractValue,
        status: isCompleted ? "completed" : "in_progress",
        scopeOfWork: pick(scopeTemplates),
        notes: `Sub-contract awarded to ${vendor.name} for ${proj.name}.`,
        startDate: proj.start,
        endDate: proj.status === "completed" ? proj.end : undefined,
        completedAt: isCompleted ? daysAgo(rand(2, 25)) : null,
        createdById: pick(managers)._id,
        createdAt: now(), updatedAt: now(),
      });
    }
  }

  // ── 16. DOCUMENTS ────────────────────────────────────────────────────────
  console.log("📁 Seeding documents...");
  const docTypes = [
    { name: "Structural Drawings - Foundation Layout",         type: "drawing",      tags: ["structural", "foundation"] },
    { name: "Architectural Floor Plans - All Levels",          type: "drawing",      tags: ["architectural", "floor_plan"] },
    { name: "BOQ - Preliminary Quantities",                    type: "report",       tags: ["financial", "boq"] },
    { name: "Soil Investigation Report",                       type: "report",       tags: ["geotechnical", "investigation"] },
    { name: "Environmental Impact Assessment",                 type: "report",       tags: ["environment", "eia"] },
    { name: "LDA Building Permit",                             type: "permit",       tags: ["permit", "legal"] },
    { name: "Site Safety Plan",                                type: "safety",       tags: ["hse", "safety"] },
    { name: "Sub-Contractor Agreement - MEP Works",            type: "contract",     tags: ["subcontractor", "mep"] },
    { name: "Material Test Report - Concrete Cube Test",       type: "test_report",  tags: ["quality", "concrete"] },
    { name: "Progress Report - Monthly",                       type: "report",       tags: ["progress", "monthly"] },
  ];
  for (const proj of projectDocs.filter(p => p.status !== "planning").slice(0, 18)) {
    const docCount = rand(3, 7);
    for (let i = 0; i < docCount; i++) {
      const dt = docTypes[i % docTypes.length];
      await db.collection("documents").insertOne({
        projectId: proj._id,
        name: `${dt.name} — ${proj.name}`,
        type: dt.type, tags: dt.tags,
        description: `${dt.name} prepared for project: ${proj.name}`,
        fileType: "application/pdf", fileSize: rand(200000, 5000000),
        uploadedById: pick(empDocs.slice(0, 10))._id,
        createdAt: daysAgo(rand(1, 90)),
      });
    }
  }

  // ── 17. ATTENDANCE ───────────────────────────────────────────────────────
  console.log("🗓️  Seeding attendance for last 30 days...");
  const attendStatuses = ["present", "present", "present", "present", "half_day", "absent"];
  const today = new Date();
  for (const emp of empDocs) {
    for (let d = 1; d <= 30; d++) {
      const date = new Date(today); date.setDate(date.getDate() - d);
      const day = date.getDay();
      if (day === 0) continue; // skip Sundays
      const st = pick(attendStatuses);
      await db.collection("attendances").insertOne({
        employeeId: emp._id,
        date, status: st,
        hoursWorked: st === "present" ? rand(8, 10) : st === "half_day" ? rand(4, 5) : 0,
        notes: st === "absent" ? pick(["Sick leave", "Personal leave", "Annual leave"]) : null,
        createdAt: now(), updatedAt: now(),
      });
    }
  }

  // ── 18. NOTIFICATIONS ────────────────────────────────────────────────────
  console.log("🔔 Seeding notifications...");
  const notifs = [
    { title: "Low Stock Alert",             message: "Portland Cement stock is below minimum threshold on Gulberg site.",         type: "warning" },
    { title: "Invoice Overdue",             message: "Invoice INV-2026-008 from PSO is 15 days overdue. Follow up required.",     type: "error" },
    { title: "Milestone Achieved",          message: "MCB Bank HQ Renovation reached 100% completion. Handover approved.",        type: "success" },
    { title: "New Project Assigned",        message: "Federal Government Hospital has been assigned to your team.",               type: "info" },
    { title: "Equipment Maintenance Due",   message: "Wirtgen W 200 Road Milling Machine is due for annual service.",            type: "warning" },
    { title: "Budget Alert",               message: "Packages Mall Phase 2 is at 80% budget utilisation with 65% work done.",   type: "warning" },
    { title: "Contract Signed",             message: "Contract for Bahria Heights Tower B has been executed and uploaded.",       type: "success" },
    { title: "Task Overdue",               message: "Steel rebar placement task on DHA Phase 9 is 5 days overdue.",             type: "error" },
    { title: "Payment Received",           message: "PKR 17,400,000 received from Bahria Town for INV-2026-001.",               type: "success" },
    { title: "Safety Inspection Due",       message: "Monthly HSE inspection due at LDA Housing Scheme Block A.",               type: "info" },
    { title: "Material Delivery Confirmed", message: "Steel bars (50 ton) confirmed for delivery on Monday from Mughal Steel.", type: "info" },
    { title: "Project On Hold",            message: "Alhamra Cultural Center Expansion placed on hold pending NOC from LDA.",   type: "warning" },
  ];
  for (const n of notifs) {
    await db.collection("notifications").insertOne({
      userId: pick([...managers, admin, ceo])._id,
      title: n.title, message: n.message, type: n.type,
      isRead: Math.random() > 0.5, createdAt: daysAgo(rand(0, 14)), updatedAt: now(),
    });
  }

  // ── 19. EQUIPMENT MAINTENANCE ────────────────────────────────────────────
  console.log("🔧 Seeding equipment maintenance logs...");
  const maintenanceLogs = [
    { eq: eqDocs[0], desc: "Engine oil change and filter replacement",         cost: 45000,  type: "routine" },
    { eq: eqDocs[1], desc: "Annual load test and safety certification",        cost: 120000, type: "inspection" },
    { eq: eqDocs[4], desc: "Drum milling teeth replacement — 480 teeth",      cost: 380000, type: "repair" },
    { eq: eqDocs[3], desc: "Hydraulic cylinder seal replacement",             cost: 75000,  type: "repair" },
    { eq: eqDocs[6], desc: "Drill bit sharpening and rotary head service",    cost: 95000,  type: "routine" },
    { eq: eqDocs[10], desc: "Drum mixer bearing replacement and lubrication", cost: 55000,  type: "repair" },
  ];
  for (const log of maintenanceLogs) {
    await db.collection("equipmentmaintenances").insertOne({
      equipmentId: log.eq._id,
      description: log.desc, cost: log.cost, maintenanceType: log.type,
      scheduledDate: daysAgo(rand(5, 90)), completedDate: daysAgo(rand(1, 30)),
      performedBy: pick(["Internal Workshop", "CAT Dealer Service", "Authorized Workshop"]),
      notes: "All replaced parts are OEM certified.",
      createdAt: now(), updatedAt: now(),
    });
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("🎉  SEED COMPLETE — all collections populated!");
  console.log("=".repeat(60));
  console.log(`\n  Projects:    ${projectDocs.length}`);
  console.log(`  Clients:     ${clientDocs.length}`);
  console.log(`  Vendors:     ${vendorDocs.length}`);
  console.log(`  Employees:   ${empDocs.length}`);
  console.log(`  Equipment:   ${eqDocs.length}`);
  console.log(`  Materials:   ${materialDocs.length}`);
  console.log(`  Invoices:    ${invoiceDocs.length}`);
  console.log(`  Bank Accts:  ${bankDocs.length}`);
  console.log("\n  Login credentials:");
  console.log("  ─────────────────────────────────────────────────────");
  console.log("  Admin:      admin@constructionlatech.com   / Admin@1234");
  console.log("  CEO:        ceo@constructionlatech.com     / Ceo@1234");
  console.log("  Manager:    manager@constructionlatech.com / Manager@1234");
  console.log("  Accountant: accountant@constructionlatech.com / Account@1234");
  console.log("=".repeat(60) + "\n");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
