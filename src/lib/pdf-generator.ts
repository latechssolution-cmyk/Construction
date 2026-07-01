import PDFDocument from "pdfkit";
import { connectDB } from "@/lib/mongoose";
import Invoice from "@/models/Invoice";
import Project from "@/models/Project";

export async function generateInvoicePDF(invoiceId: string): Promise<Buffer> {
  await connectDB();
  const invoice = await Invoice.findById(invoiceId)
    .populate("client")
    .populate("project", "name")
    .populate("createdBy", "name");

  if (!invoice) throw new Error("Invoice not found");

  const inv = invoice.toJSON() as any;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "Construction LAtech";
    const primaryColor = "#1d4ed8";
    const grayColor = "#6b7280";
    const lightGray = "#f3f4f6";

    doc.rect(0, 0, doc.page.width, 100).fill(primaryColor);
    doc.fillColor("white").fontSize(24).font("Helvetica-Bold").text(appName, 50, 30);
    doc.fontSize(10).font("Helvetica").text("Construction Management Portal", 50, 60);
    doc.fillColor("white").fontSize(28).font("Helvetica-Bold").text("INVOICE", 400, 30, { align: "right" });
    doc.fontSize(11).font("Helvetica").text(`# ${inv.invoiceNumber}`, 400, 65, { align: "right" });

    doc.fillColor("#111827").fontSize(10).font("Helvetica-Bold").text("BILL TO:", 50, 120);
    doc.font("Helvetica").fillColor("#374151");
    doc.text(inv.client?.name || "—", 50, 135);
    if (inv.client?.address) doc.text(inv.client.address, 50, 150);
    if (inv.client?.phone) doc.text(`Tel: ${inv.client.phone}`, 50, 165);
    if (inv.client?.email) doc.text(`Email: ${inv.client.email}`, 50, 180);

    const metaX = 350;
    doc.fillColor("#111827").font("Helvetica-Bold").text("Issue Date:", metaX, 120);
    doc.font("Helvetica").fillColor("#374151").text(new Date(inv.issueDate).toLocaleDateString("en-PK"), metaX + 80, 120);

    if (inv.dueDate) {
      doc.font("Helvetica-Bold").fillColor("#111827").text("Due Date:", metaX, 140);
      doc.font("Helvetica").fillColor("#374151").text(new Date(inv.dueDate).toLocaleDateString("en-PK"), metaX + 80, 140);
    }
    if (inv.project?.name) {
      doc.font("Helvetica-Bold").fillColor("#111827").text("Project:", metaX, 160);
      // Constrain project name to remaining page width so it never wraps into Status row
      doc.font("Helvetica").fillColor("#374151").text(
        inv.project.name,
        metaX + 80, 160,
        { width: doc.page.width - (metaX + 80) - 30, lineBreak: false, ellipsis: true }
      );
    }
    doc.font("Helvetica-Bold").fillColor("#111827").text("Status:", metaX, 180);
    doc.font("Helvetica").fillColor("#374151").text(inv.status.toUpperCase(), metaX + 80, 180, { lineBreak: false });

    // Wider description column so long names fit without awkward wrapping
    const tableTop = 220;
    const colWidths = [230, 55, 65, 85, 75];
    const colX = [50, 280, 335, 400, 485];
    const ROW_V_PAD = 6; // vertical padding inside each row

    doc.rect(50, tableTop, 510, 22).fill(primaryColor);
    ["Description", "Qty", "Unit", "Unit Price", "Total"].forEach((h, i) => {
      doc.fillColor("white").font("Helvetica-Bold").fontSize(9)
        .text(h, colX[i], tableTop + 6, { width: colWidths[i], align: i > 1 ? "right" : "left" });
    });

    let y = tableTop + 22;
    (inv.items || []).forEach((item: any, idx: number) => {
      // Calculate height needed for this description so nothing gets clipped
      doc.font("Helvetica").fontSize(9);
      const descH = doc.heightOfString(item.description || "", { width: colWidths[0] - 4 });
      const rowH = Math.max(22, descH + ROW_V_PAD * 2);

      doc.rect(50, y, 510, rowH).fill(idx % 2 === 0 ? "white" : lightGray);
      doc.fillColor("#111827").font("Helvetica").fontSize(9);
      doc.text(item.description, colX[0], y + ROW_V_PAD, { width: colWidths[0] - 4 });
      // Numeric columns vertically centred on first text line
      const numY = y + ROW_V_PAD;
      doc.text(String(item.quantity), colX[1], numY, { width: colWidths[1], align: "right" });
      doc.text(item.unit || "—", colX[2], numY, { width: colWidths[2], align: "right" });
      doc.text(`PKR ${(item.unitPrice || 0).toLocaleString()}`, colX[3], numY, { width: colWidths[3], align: "right" });
      doc.text(`PKR ${(item.total || 0).toLocaleString()}`, colX[4], numY, { width: colWidths[4], align: "right" });
      y += rowH;
    });

    doc.rect(50, y, 510, 1).fill(primaryColor);
    y += 10;

    const totalsX = 350;
    doc.fillColor(grayColor).font("Helvetica").fontSize(10)
      .text("Subtotal:", totalsX, y + 5, { width: 100 })
      .text(`PKR ${(inv.subtotal || 0).toLocaleString()}`, totalsX + 100, y + 5, { width: 110, align: "right" });
    y += 20;

    if ((inv.taxPercent || 0) > 0) {
      doc.text(`Tax (${inv.taxPercent}%):`, totalsX, y + 5, { width: 100 })
        .text(`PKR ${(inv.taxAmount || 0).toLocaleString()}`, totalsX + 100, y + 5, { width: 110, align: "right" });
      y += 20;
    }

    doc.rect(totalsX - 5, y, 220, 26).fill(primaryColor);
    doc.fillColor("white").font("Helvetica-Bold").fontSize(12)
      .text("Grand Total:", totalsX, y + 7, { width: 100 })
      .text(`PKR ${(inv.grandTotal || 0).toLocaleString()}`, totalsX + 100, y + 7, { width: 110, align: "right" });
    y += 40;

    if (inv.notes) {
      doc.fillColor("#111827").font("Helvetica-Bold").fontSize(10).text("Notes:", 50, y + 5);
      doc.font("Helvetica").fillColor(grayColor).fontSize(9).text(inv.notes, 50, y + 20, { width: 510 });
      y += 50;
    }

    // Signature — drawn relative to content, no forced minimum that causes overflow
    y += 30;
    doc.moveTo(350, y).lineTo(560, y).stroke("#9ca3af");
    doc.fillColor("#111827").font("Helvetica").fontSize(9).text("Authorized Signature", 350, y + 5);
    doc.text(appName, 350, y + 18);

    // Footer — pinned to bottom of the same page using absolute positioning
    const footerY = doc.page.height - 40;
    doc.rect(0, footerY, doc.page.width, 40).fill(primaryColor);
    doc.fillColor("white").fontSize(8).font("Helvetica")
      .text(
        `${appName} · Thank you for your business · Generated on ${new Date().toLocaleDateString("en-PK")}`,
        50, footerY + 16,
        { align: "center", width: doc.page.width - 100 }
      );

    doc.end();
  });
}

export async function generateProjectReportPDF(projectId: string): Promise<Buffer> {
  await connectDB();
  const project = await Project.findById(projectId)
    .populate("client")
    .populate("assignedManager", "name")
    .populate({ path: "phases", populate: { path: "tasks" } })
    .populate("tasks")
    .populate("milestones")
    .populate({ path: "materials", populate: { path: "vendor", select: "name" } })
    .populate("ledgerEntries");

  if (!project) throw new Error("Project not found");

  const p = project.toJSON() as any;
  const totalIncome = (p.ledgerEntries || []).filter((e: any) => e.type === "income").reduce((s: number, e: any) => s + e.amount, 0);
  const totalExpense = (p.ledgerEntries || []).filter((e: any) => e.type === "expense").reduce((s: number, e: any) => s + e.amount, 0);
  const completedTasks = (p.tasks || []).filter((t: any) => t.status === "completed").length;
  const completedMilestones = (p.milestones || []).filter((m: any) => m.completedAt).length;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const appName = process.env.NEXT_PUBLIC_APP_NAME || "Construction LAtech";
    const primaryColor = "#1d4ed8";

    doc.rect(0, 0, doc.page.width, 90).fill(primaryColor);
    doc.fillColor("white").fontSize(22).font("Helvetica-Bold").text(`Project Report`, 50, 20);
    doc.fontSize(14).font("Helvetica").text(p.name, 50, 48);
    doc.fontSize(9).text(`Generated: ${new Date().toLocaleDateString("en-PK")}`, 50, 68);

    let y = 110;
    const infoRows: [string, string][] = [
      ["Client", p.client?.name || "—"],
      ["Location", p.location || "—"],
      ["Type", p.type],
      ["Status", (p.status || "").replace("_", " ").toUpperCase()],
      ["Manager", p.assignedManager?.name || "—"],
      ["Budget", `PKR ${(p.budget || 0).toLocaleString()}`],
      ["Total Income", `PKR ${totalIncome.toLocaleString()}`],
      ["Total Expense", `PKR ${totalExpense.toLocaleString()}`],
      ["Net Profit", `PKR ${(totalIncome - totalExpense).toLocaleString()}`],
      ["Tasks", `${completedTasks}/${(p.tasks || []).length} completed`],
      ["Milestones", `${completedMilestones}/${(p.milestones || []).length} completed`],
    ];

    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(12).text("Project Summary", 50, y);
    y += 18;
    doc.rect(50, y, 510, 1).fill(primaryColor);
    y += 8;

    infoRows.forEach(([label, value]) => {
      doc.font("Helvetica-Bold").fillColor("#374151").fontSize(10).text(label + ":", 50, y, { width: 150 });
      doc.font("Helvetica").text(value, 200, y);
      y += 18;
    });

    // Materials page
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 60).fill(primaryColor);
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("Materials Summary", 50, 20);
    doc.fontSize(9).font("Helvetica").text(p.name, 50, 42);
    y = 80;

    doc.rect(50, y, 510, 20).fill(primaryColor);
    const mHeaders = ["Item", "Qty", "Unit", "Unit Price", "Total", "Vendor"];
    const mColX = [50, 175, 215, 270, 350, 430];
    const mColW = [120, 35, 50, 75, 75, 130];
    mHeaders.forEach((h, i) => {
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8)
        .text(h, mColX[i], y + 5, { width: mColW[i], align: i > 1 ? "right" : "left" });
    });
    y += 20;

    (p.materials || []).forEach((m: any, idx: number) => {
      if (y > 730) { doc.addPage(); y = 50; }
      doc.rect(50, y, 510, 18).fill(idx % 2 === 0 ? "white" : "#f9fafb");
      doc.fillColor("#111827").font("Helvetica").fontSize(8);
      doc.text(m.itemName, mColX[0], y + 4, { width: mColW[0] });
      doc.text(String(m.quantity), mColX[1], y + 4, { width: mColW[1], align: "right" });
      doc.text(m.unit, mColX[2], y + 4, { width: mColW[2], align: "right" });
      doc.text(`PKR ${(m.unitPrice || 0).toLocaleString()}`, mColX[3], y + 4, { width: mColW[3], align: "right" });
      doc.text(`PKR ${(m.totalPrice || 0).toLocaleString()}`, mColX[4], y + 4, { width: mColW[4], align: "right" });
      doc.text(m.vendor?.name || "—", mColX[5], y + 4, { width: mColW[5] });
      y += 18;
    });

    // Financials page
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 60).fill(primaryColor);
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("Financial Summary", 50, 20);
    y = 80;

    doc.rect(50, y, 510, 20).fill(primaryColor);
    const lHeaders = ["Date", "Type", "Category", "Amount", "Description"];
    const lColX = [50, 120, 185, 300, 380];
    const lColW = [65, 60, 110, 75, 180];
    lHeaders.forEach((h, i) => {
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8)
        .text(h, lColX[i], y + 5, { width: lColW[i], align: i === 3 ? "right" : "left" });
    });
    y += 20;

    (p.ledgerEntries || []).forEach((e: any, idx: number) => {
      if (y > 730) { doc.addPage(); y = 50; }
      doc.rect(50, y, 510, 18).fill(idx % 2 === 0 ? "white" : "#f9fafb");
      const color = e.type === "income" ? "#15803d" : "#dc2626";
      doc.fillColor("#111827").font("Helvetica").fontSize(8);
      doc.text(new Date(e.date).toLocaleDateString("en-PK"), lColX[0], y + 4, { width: lColW[0] });
      doc.fillColor(color).text((e.type || "").toUpperCase(), lColX[1], y + 4, { width: lColW[1] });
      doc.fillColor("#111827").text(e.category, lColX[2], y + 4, { width: lColW[2] });
      doc.fillColor(color).text(`PKR ${(e.amount || 0).toLocaleString()}`, lColX[3], y + 4, { width: lColW[3], align: "right" });
      doc.fillColor("#374151").text(e.description || "—", lColX[4], y + 4, { width: lColW[4] });
      y += 18;
    });

    // Tasks & Milestones
    doc.addPage();
    doc.rect(0, 0, doc.page.width, 60).fill(primaryColor);
    doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("Tasks & Milestones", 50, 20);
    y = 80;

    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11).text("Tasks", 50, y);
    y += 15;
    (p.tasks || []).forEach((t: any) => {
      if (y > 730) { doc.addPage(); y = 50; }
      const statusColor = t.status === "completed" ? "#15803d" : t.status === "in_progress" ? "#1d4ed8" : "#6b7280";
      doc.rect(50, y, 8, 8).fill(statusColor);
      doc.fillColor("#111827").font("Helvetica").fontSize(9).text(t.title, 65, y - 1, { width: 380 });
      doc.fillColor(statusColor).text((t.status || "").replace("_", " "), 450, y - 1);
      y += 16;
    });

    y += 10;
    doc.fillColor("#111827").font("Helvetica-Bold").fontSize(11).text("Milestones", 50, y);
    y += 15;
    (p.milestones || []).forEach((m: any) => {
      if (y > 730) { doc.addPage(); y = 50; }
      const done = !!m.completedAt;
      doc.rect(50, y, 8, 8).fill(done ? "#15803d" : "#6b7280");
      doc.fillColor("#111827").font("Helvetica").fontSize(9).text(m.name, 65, y - 1, { width: 380 });
      doc.fillColor(done ? "#15803d" : "#6b7280").text(done ? "Completed" : "Pending", 450, y - 1);
      y += 16;
    });

    doc.end();
  });
}
