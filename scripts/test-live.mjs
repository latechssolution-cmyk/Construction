import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local") });

const BASE = process.env.NEXTAUTH_URL || process.env.BASE_URL || "https://construction00.netlify.app";
let cookies = "";

// ── HTTP helpers ──────────────────────────────────────────────────────────────
async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: { cookie: cookies } });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}
async function post(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie: cookies },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}
async function put(path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method: "PUT", headers: { "Content-Type": "application/json", cookie: cookies },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}
async function del(path) {
  const r = await fetch(`${BASE}${path}`, { method: "DELETE", headers: { cookie: cookies } });
  const text = await r.text();
  try { return { status: r.status, data: JSON.parse(text) }; }
  catch { return { status: r.status, data: text }; }
}

// ── Test runner ───────────────────────────────────────────────────────────────
let passed = 0, failed = 0, issues = [];
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ✅ ${label}`); passed++; }
  else { console.log(`  ❌ ${label}${detail ? " — " + detail : ""}`); failed++; issues.push(`${label}${detail ? ": " + detail : ""}`); }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
async function login() {
  const csrfResp = await fetch(`${BASE}/api/auth/csrf`);
  const csrfCookies = csrfResp.headers.getSetCookie?.() ?? [];
  const csrfToken = (await csrfResp.json()).csrfToken;

  const csrfCookie = csrfCookies.find(c => c.includes(csrfToken));
  const callbackCookie = csrfCookies.find(c => c.startsWith("authjs.callback-url"));
  const preCookies = [csrfCookie, callbackCookie].filter(Boolean)
    .map(c => c.split(";")[0]).join("; ");

  const r = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: preCookies },
    body: `csrfToken=${csrfToken}&email=admin%40constructionlatech.com&password=Admin%401234&redirect=false&json=true`,
  });
  const setCookie = r.headers.getSetCookie?.() ?? [];
  cookies = setCookie.map(c => c.split(";")[0]).join("; ");
  const sess = await (await fetch(`${BASE}/api/auth/session`, { headers: { cookie: cookies } })).json();
  return sess?.user;
}

// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=".repeat(60));
  console.log("  Construction ERP — Live Netlify System Test (Updated)");
  console.log("=".repeat(60));

  // ── Auth ──────────────────────────────────────────────────────────────────
  console.log("\n[AUTH]");
  const user = await login();
  check("Login as admin", user?.role === "admin", JSON.stringify(user));

  // ── Clients ───────────────────────────────────────────────────────────────
  console.log("\n[CLIENTS]");
  const { status: cListSt, data: clients } = await get("/api/clients");
  check("GET /api/clients → 200", cListSt === 200);
  check("Clients have id field", Array.isArray(clients) && clients.every(c => c.id), `missing ids: ${clients?.filter?.(c=>!c.id)?.length}`);
  check("Clients have _count", Array.isArray(clients) && clients.every(c => c._count !== undefined));

  const { status: cPostSt, data: newClient } = await post("/api/clients", { name: "TEST_CLIENT_XYZ", phone: "03001234567", email: "test@test.com" });
  check("POST /api/clients → 201", cPostSt === 201, newClient?.error);
  check("New client has id", !!newClient?.id);
  const clientId = newClient?.id;

  const { status: cGetSt, data: cGet } = await get(`/api/clients/${clientId}`);
  check("GET /api/clients/:id → 200", cGetSt === 200, cGet?.error);
  check("Client GET has name", cGet?.name === "TEST_CLIENT_XYZ");

  const { status: cPutSt, data: cPut } = await put(`/api/clients/${clientId}`, { name: "TEST_CLIENT_UPDATED", notes: "updated" });
  check("PUT /api/clients/:id → 200", cPutSt === 200, cPut?.error);
  check("Client name updated", cPut?.name === "TEST_CLIENT_UPDATED");

  // ── Projects ──────────────────────────────────────────────────────────────
  console.log("\n[PROJECTS]");
  const { status: pListSt, data: projects } = await get("/api/projects");
  check("GET /api/projects → 200", pListSt === 200);
  check("Projects have id field", Array.isArray(projects) && projects.every(p => p.id), `count=${projects?.length}`);
  check("Projects have tasks array", Array.isArray(projects) && projects.every(p => Array.isArray(p.tasks)));

  const { status: pPostSt, data: newProj } = await post("/api/projects", {
    name: "TEST_PROJECT_AAA", type: "commercial", status: "planning",
    budget: 1000000, location: "Lahore", clientId: clientId,
  });
  check("POST /api/projects → 201", pPostSt === 201, newProj?.error);
  check("New project has id", !!newProj?.id);
  const projId = newProj?.id;

  const { status: pGetSt, data: pGet } = await get(`/api/projects/${projId}`);
  check("GET /api/projects/:id → 200", pGetSt === 200, pGet?.error);
  check("Project detail has client", pGet?.client?.name === "TEST_CLIENT_UPDATED");
  check("Project detail has milestones array", Array.isArray(pGet?.milestones));
  check("Project detail has tasks array", Array.isArray(pGet?.tasks));
  check("Project detail has materials array", Array.isArray(pGet?.materials));

  const { status: pPutSt, data: pPut } = await put(`/api/projects/${projId}`, { status: "in_progress", completionPercent: 25 });
  check("PUT /api/projects/:id → 200", pPutSt === 200, pPut?.error);
  check("Project status updated", pPut?.status === "in_progress");
  check("Project completion updated", pPut?.completionPercent === 25);

  // ── Vendors ───────────────────────────────────────────────────────────────
  console.log("\n[VENDORS]");
  const { status: vListSt, data: vendors } = await get("/api/vendors");
  check("GET /api/vendors → 200", vListSt === 200);
  check("Vendors have id field", Array.isArray(vendors) && vendors.every(v => v.id));

  const { status: vPostSt, data: newVendor } = await post("/api/vendors", { name: "TEST_VENDOR_ZZZ", category: "materials", phone: "03009999999" });
  check("POST /api/vendors → 201", vPostSt === 201, newVendor?.error);
  check("New vendor has id", !!newVendor?.id);
  const vendorId = newVendor?.id;

  const { status: vPutSt, data: vPut } = await put(`/api/vendors/${vendorId}`, { name: "TEST_VENDOR_UPDATED", isActive: true });
  check("PUT /api/vendors/:id → 200", vPutSt === 200, vPut?.error);

  // ── Bank accounts ─────────────────────────────────────────────────────────
  console.log("\n[BANK ACCOUNTS]");
  const { status: bListSt, data: banks } = await get("/api/bank-accounts");
  check("GET /api/bank-accounts → 200", bListSt === 200);
  check("Bank accounts have id", Array.isArray(banks) && banks.every(b => b.id));
  const bankId = banks?.[0]?.id;

  // ── Materials ─────────────────────────────────────────────────────────────
  console.log("\n[MATERIALS — including ledger verification]");
  const { data: ledger0 } = await get("/api/ledger");
  const ledgerCountBefore = ledger0?.pagination?.total ?? 0;

  const { status: mPostSt, data: newMat } = await post("/api/materials", {
    itemName: "TEST_CEMENT_AAA", category: "cement", unit: "bags",
    quantity: 100, unitPrice: 500, minStockLevel: 20,
    projectId: projId, vendorId: vendorId, bankAccountId: bankId,
  });
  check("POST /api/materials → 201", mPostSt === 201, newMat?.error);
  check("New material has id", !!newMat?.id);
  check("Initial stock = quantity", newMat?.stockQuantity === 100);
  check("totalPrice = qty × price", newMat?.totalPrice === 50000);
  const matId = newMat?.id;

  // Check ledger entry created for initial purchase
  const { data: ledger1 } = await get("/api/ledger");
  const ledgerCountAfterCreate = ledger1?.pagination?.total ?? 0;
  check("Ledger entry created on material create", ledgerCountAfterCreate > ledgerCountBefore,
    `before=${ledgerCountBefore} after=${ledgerCountAfterCreate}`);
  const matCreateEntry = ledger1?.data && Array.isArray(ledger1.data) && ledger1.data.find(e => e.description?.includes("TEST_CEMENT_AAA") && e.category === "inventory_asset");
  check("Ledger entry has correct amount (PKR 50000)", matCreateEntry?.amount === 50000, `got ${matCreateEntry?.amount}`);
  check("Ledger entry is expense type", matCreateEntry?.type === "expense");

  // Restock +100 bags @ PKR 600
  const { status: mRestockSt, data: mRestock } = await put(`/api/materials/${matId}`, {
    restockQuantity: 100, unitPrice: 600, bankAccountId: bankId,
  });
  check("PUT /api/materials/:id (restock) → 200", mRestockSt === 200, mRestock?.error);
  check("Stock increased after restock", mRestock?.stockQuantity === 200, `got ${mRestock?.stockQuantity}`);
  check("Unit price updated to weighted average price after restock", mRestock?.unitPrice === 550, `got ${mRestock?.unitPrice}`);
  check("Total price cumulative (based on weighted average price)", mRestock?.totalPrice === 110000, `got ${mRestock?.totalPrice} expected 110000`); // 200 * 550 = 110000

  // Check ledger entry for restock
  const { data: ledger2 } = await get("/api/ledger");
  const ledgerCountAfterRestock = ledger2?.pagination?.total ?? 0;
  check("Ledger entry created on restock", ledgerCountAfterRestock > ledgerCountAfterCreate,
    `before=${ledgerCountAfterCreate} after=${ledgerCountAfterRestock}`);
  const restockEntry = ledger2?.data && Array.isArray(ledger2.data) && ledger2.data.find(e => e.description?.includes("TEST_CEMENT_AAA") && e.description?.includes("Restock"));
  check("Restock ledger amount = 100×600 = PKR 60000", restockEntry?.amount === 60000, `got ${restockEntry?.amount}`);

  // Edit (should NOT add ledger entry)
  const { status: mEditSt, data: mEdit } = await put(`/api/materials/${matId}`, {
    itemName: "TEST_CEMENT_UPDATED", minStockLevel: 30,
  });
  check("PUT /api/materials/:id (edit) → 200", mEditSt === 200, mEdit?.error);
  check("Name updated on edit", mEdit?.itemName === "TEST_CEMENT_UPDATED");
  check("Stock unchanged on plain edit", mEdit?.stockQuantity === 200, `got ${mEdit?.stockQuantity}`);

  const { data: ledger3 } = await get("/api/ledger");
  const ledgerCountAfterEdit = ledger3?.pagination?.total ?? 0;
  check("No ledger entry on plain edit", ledgerCountAfterEdit === ledgerCountAfterRestock,
    `before=${ledgerCountAfterRestock} after=${ledgerCountAfterEdit}`);

  // GET materials list — check id field
  const { status: mListSt, data: matList } = await get("/api/materials");
  check("GET /api/materials → 200", mListSt === 200, matList?.error);
  const materialsData = matList?.data || [];
  check("All materials have id", Array.isArray(materialsData) && materialsData.every(m => m.id),
    `missing=${materialsData?.filter?.(m=>!m.id)?.length}`);
  check("All materials have project populated", Array.isArray(materialsData) && materialsData.some(m => m.project?.name));

  // Material usage log
  const { status: usageSt, data: usage } = await post("/api/material-usage", {
    materialId: matId, quantityUsed: 30, purpose: "Foundation pour", date: new Date().toISOString().slice(0,10),
  });
  check("POST /api/material-usage → 201 or 200", usageSt === 201 || usageSt === 200, usage?.error);
  // Verify stock reduced
  const { data: matAfterUse } = await get(`/api/materials/${matId}`);
  check("Stock reduced after usage log", matAfterUse?.stockQuantity === 170, `got ${matAfterUse?.stockQuantity}`);

  // ── Tasks ─────────────────────────────────────────────────────────────────
  console.log("\n[TASKS]");
  const { status: tPostSt, data: newTask } = await post("/api/tasks", {
    title: "TEST_TASK_AAA", projectId: projId, priority: "high", status: "todo",
    dueDate: new Date(Date.now() + 7*86400000).toISOString().slice(0,10),
  });
  check("POST /api/tasks → 201", tPostSt === 201, newTask?.error);
  check("Task has id", !!newTask?.id);
  const taskId = newTask?.id;

  const { status: tPutSt, data: tPut } = await put(`/api/tasks/${taskId}`, { status: "in_progress" });
  check("PUT /api/tasks/:id → 200", tPutSt === 200, tPut?.error);
  check("Task status updated", tPut?.status === "in_progress");

  const { status: tCompSt, data: tComp } = await put(`/api/tasks/${taskId}`, { status: "completed" });
  check("Task mark completed → 200", tCompSt === 200, tComp?.error);
  check("completedAt set", !!tComp?.completedAt);

  const { data: projAfterTask } = await get(`/api/projects/${projId}`);
  check("Project completion% updated after task completion", projAfterTask?.completionPercent === 100,
    `got ${projAfterTask?.completionPercent}%`);

  // ── Employees ─────────────────────────────────────────────────────────────
  console.log("\n[EMPLOYEES]");
  const { status: ePostSt, data: newEmp } = await post("/api/employees", {
    name: "TEST_EMP_AAA", role: "worker", department: "Civil", salary: 50000, salaryType: "monthly",
    phone: "03001110000", joiningDate: "2025-01-01",
  });
  check("POST /api/employees → 201", ePostSt === 201, newEmp?.error);
  check("Employee has id", !!newEmp?.id);
  const empId = newEmp?.id;

  const { data: empList } = await get("/api/employees");
  const employeesData = empList?.data || [];
  check("GET /api/employees → has id on all", Array.isArray(employeesData) && employeesData.every(e => e.id));

  // ── Attendance ────────────────────────────────────────────────────────────
  console.log("\n[ATTENDANCE]");
  const today = new Date().toISOString().slice(0,10);
  const { status: attSt, data: att } = await post("/api/attendance", {
    employeeId: empId, date: today, status: "present", hoursWorked: 8, projectId: projId,
  });
  check("POST /api/attendance → 200 or 201", attSt === 200 || attSt === 201, att?.error);
  check("Attendance has employee populated", !!att?.employee);

  // Update same day attendance (should update existing, not duplicate)
  const { status: attUpdateSt, data: attUpdate } = await post("/api/attendance", {
    employeeId: empId, date: today, status: "half_day", hoursWorked: 4,
  });
  check("Attendance update same day → 200", attUpdateSt === 200, attUpdate?.error);
  check("Status updated to half_day", attUpdate?.status === "half_day");
  check("hoursWorked updated", attUpdate?.hoursWorked === 4);

  // ── Invoices ──────────────────────────────────────────────────────────────
  console.log("\n[INVOICES]");
  const { status: invPostSt, data: newInv } = await post("/api/invoices", {
    clientId: clientId, projectId: projId,
    issueDate: today, dueDate: new Date(Date.now() + 30*86400000).toISOString().slice(0,10),
    status: "draft", taxPercent: 17,
    items: [
      { description: "Civil works Phase 1", quantity: 1, unitPrice: 500000 },
      { description: "Electrical works", quantity: 1, unitPrice: 150000 },
    ],
  });
  check("POST /api/invoices → 201", invPostSt === 201, newInv?.error);
  check("Invoice has id", !!newInv?.id);
  check("Invoice subtotal correct", newInv?.subtotal === 650000, `got ${newInv?.subtotal}`);
  check("Invoice tax correct (17%)", Math.round(newInv?.taxAmount) === 110500, `got ${newInv?.taxAmount}`);
  check("Invoice grandTotal correct", Math.round(newInv?.grandTotal) === 760500, `got ${newInv?.grandTotal}`);
  const invId = newInv?.id;

  // Transition invoice: draft -> sent (keep in sent status so we can delete it during cleanup)
  const { status: invSentSt, data: invSent } = await put(`/api/invoices/${invId}`, { status: "sent" });
  check("Transition invoice to sent → 200", invSentSt === 200, invSent?.error);

  // ── Ledger (manual payment) ───────────────────────────────────────────────
  console.log("\n[LEDGER / PAYMENTS]");
  const { status: ledPostSt, data: ledPost } = await post("/api/ledger", {
    date: today, type: "expense", amount: 25000, category: "transport",
    description: "Site transport test", projectId: projId, bankAccountId: bankId,
  });
  check("POST /api/ledger → 201", ledPostSt === 201, ledPost?.error);
  check("Ledger entry has id", !!ledPost?.id);

  const { status: ledGetSt, data: ledGet } = await get("/api/ledger");
  check("GET /api/ledger → 200", ledGetSt === 200);
  check("Ledger entries have id", ledGet?.data && Array.isArray(ledGet.data) && ledGet.data.every(e => e.id || e._id));

  // Ledger summary
  const { status: sumSt, data: summary } = await get("/api/ledger/summary");
  check("GET /api/ledger/summary → 200", sumSt === 200, summary?.error);
  check("Summary has totalIncome", typeof summary?.totals?.totalIncome === "number", JSON.stringify(Object.keys(summary || {})));
  check("Summary has totalExpenses", typeof summary?.totals?.totalExpense === "number");

  // ── Documents ─────────────────────────────────────────────────────────────
  console.log("\n[DOCUMENTS]");
  const { status: docPostSt, data: newDoc } = await post("/api/documents", {
    name: "TEST_DOC.pdf", type: "contract", projectId: projId,
    fileUrl: "https://res.cloudinary.com/test/test.pdf", fileSize: 12345,
  });
  check("POST /api/documents → 201", docPostSt === 201, newDoc?.error);
  check("Document has id", !!newDoc?.id);
  const docId = newDoc?.id;

  const { status: docListSt, data: docList } = await get("/api/documents");
  check("GET /api/documents → 200", docListSt === 200);
  check("Documents returned", Array.isArray(docList) && docList.length > 0);

  const { status: docDelSt, data: docDel } = await del(`/api/documents/${docId}`);
  check("DELETE /api/documents/:id → 200", docDelSt === 200, docDel?.error);

  // ── Equipment ─────────────────────────────────────────────────────────────
  console.log("\n[EQUIPMENT]");
  const { status: eqListSt, data: eqList } = await get("/api/equipment");
  check("GET /api/equipment → 200", eqListSt === 200);
  check("Equipment have id", Array.isArray(eqList) && eqList.every(e => e.id));

  const { status: eqPostSt, data: newEq } = await post("/api/equipment", {
    name: "TEST_EXCAVATOR", type: "excavator", model: "CAT 320", condition: "good", status: "available",
  });
  check("POST /api/equipment → 201", eqPostSt === 201, newEq?.error);
  check("Equipment has id", !!newEq?.id);
  const eqId = newEq?.id;

  // ── Notifications ─────────────────────────────────────────────────────────
  console.log("\n[NOTIFICATIONS]");
  const { status: notifSt, data: notifs } = await get("/api/notifications");
  check("GET /api/notifications → 200", notifSt === 200, notifs?.error);

  // ── Dashboard (all roles) ─────────────────────────────────────────────────
  console.log("\n[DASHBOARDS]");
  for (const role of ["admin", "ceo", "manager", "accountant"]) {
    const { status: dashSt, data: dash } = await get(`/api/dashboard/${role}`);
    check(`GET /api/dashboard/${role} → 200`, dashSt === 200, dash?.error);
  }

  // ── Contracts ─────────────────────────────────────────────────────────────
  console.log("\n[CONTRACTS]");
  const { status: conPostSt, data: newCon } = await post("/api/contracts", {
    title: "TEST_CONTRACT_AAA", clientId: clientId,
    contractValue: 2000000, startDate: today, status: "active",
  });
  check("POST /api/contracts → 201", conPostSt === 201, newCon?.error);
  check("Contract has id", !!newCon?.id);
  const conId = newCon?.id;

  const { status: conListSt, data: conList } = await get("/api/contracts");
  check("GET /api/contracts → 200", conListSt === 200);

  // ── Milestones ────────────────────────────────────────────────────────────
  console.log("\n[MILESTONES]");
  const { status: mileSt, data: mileNew } = await post(`/api/projects/${projId}/milestones`, {
    name: "TEST_MILESTONE_AAA", dueDate: new Date(Date.now() + 14*86400000).toISOString().slice(0,10),
  });
  check("POST /api/projects/:id/milestones → 201", mileSt === 201, mileNew?.error);
  check("Milestone has id", !!mileNew?.id);
  const mileId = mileNew?.id;

  const { status: milePutSt, data: milePut } = await put(`/api/milestones/${mileId}`, { completed: true });
  check("Mark milestone complete → 200", milePutSt === 200, milePut?.error);
  check("completedAt set on milestone", !!milePut?.completedAt);

  // ── Cleanup — run in dependency order ─────────────────────────────────────
  console.log("\n[CLEANUP]");
  
  // Clean up financial and child entries first
  const wave1 = await Promise.all([
    del(`/api/materials/${matId}`),
    del(`/api/tasks/${taskId}`),
    del(`/api/invoices/${invId}`),
    del(`/api/equipment/${eqId}`),
    del(`/api/employees/${empId}`),
    del(`/api/contracts/${conId}`),
    del(`/api/ledger/${ledPost.id || ledPost._id}`), // manual ledger entry
  ]);
  
  // Update status of project to allow deletion
  await put(`/api/projects/${projId}`, { status: "cancelled" });
  
  const wave2 = await Promise.all([
    del(`/api/projects/${projId}`),
  ]);
  
  const wave3 = await Promise.all([
    del(`/api/clients/${clientId}`),
    del(`/api/vendors/${vendorId}`),
  ]);
  
  const results = [...wave1, ...wave2, ...wave3];
  check("All test data cleaned up", results.every(r => r.status === 200 || r.status === 204),
    results.filter(r=>r.status!==200&&r.status!==204).map(r=>`${r.status}:${JSON.stringify(r.data)}`).join(", "));

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log(`  RESULTS: ${passed} passed, ${failed} failed`);
  if (issues.length) {
    console.log("\n  FAILURES:");
    issues.forEach(i => console.log(`    ❌ ${i}`));
  } else {
    console.log("  All checks passed!");
  }
  console.log("=".repeat(60));
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
