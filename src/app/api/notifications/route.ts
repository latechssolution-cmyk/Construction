import { requireAuth, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Task from "@/models/Task";
import Invoice from "@/models/Invoice";
import Material from "@/models/Material";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";
import Notification from "@/models/Notification";

export async function GET() {
  try {
    const session = await requireAuth();
    const role = session.user.role;
    const userId = session.user.id;
    const now = new Date();
    const in7Days = new Date(Date.now() + 7 * 86400000);
    const isFinance = ["admin", "ceo", "accountant"].includes(role);
    const isOps = ["admin", "ceo", "manager"].includes(role);
    await connectDB();

    let projectFilter: any = {};
    if (role === "manager") {
      const myProjects = await Project.find({ assignedManagerId: userId }, { _id: 1 });
      const myIds = myProjects.map((p) => p._id);
      projectFilter = { projectId: { $in: myIds } };
    }

    const [overdueTasks, overdueInvoices, lowStockMaterials, upcomingMilestones, persisted] = await Promise.all([
      isOps ? Task.find({ ...projectFilter, status: { $ne: "completed" }, dueDate: { $lt: now } }, { title: 1, dueDate: 1, projectId: 1 })
        .populate("project", "name").sort({ dueDate: 1 }).limit(10).lean({ virtuals: true }) : Promise.resolve([]),
      isFinance ? Invoice.find({ status: { $in: ["sent","overdue"] }, dueDate: { $lt: now }, deletedAt: null }, { invoiceNumber: 1, dueDate: 1, grandTotal: 1 })
        .populate("client", "name").sort({ dueDate: 1 }).limit(10).lean({ virtuals: true }) : Promise.resolve([]),
      isOps ? Material.find({ ...projectFilter, $expr: { $lte: ["$stockQuantity", "$minStockLevel"] } }, { itemName: 1, stockQuantity: 1, minStockLevel: 1, unit: 1 }).limit(10).lean() : Promise.resolve([]),
      isOps ? Milestone.find({ ...projectFilter, completedAt: null, dueDate: { $lte: in7Days, $gte: now } }, { name: 1, dueDate: 1 })
        .populate("project", "name").sort({ dueDate: 1 }).limit(10).lean({ virtuals: true }) : Promise.resolve([]),
      Notification.find({ userId, isRead: false }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const notifications = [
      ...(overdueTasks as any[]).map((t: any) => ({
        id: "task-" + t.id,
        type: "overdue_task",
        icon: "warning",
        title: "Overdue Task",
        body: `"${t.title}" in ${t.project?.name || "a project"} is past its due date.`,
        href: "/tasks",
        date: t.dueDate,
      })),
      ...(overdueInvoices as any[]).map((i: any) => ({
        id: "inv-" + i.id,
        type: "overdue_invoice",
        icon: "invoice",
        title: "Unpaid Invoice",
        body: `Invoice ${i.invoiceNumber} from ${i.client?.name || "client"} — PKR ${(i.grandTotal || 0).toLocaleString()} overdue.`,
        href: "/billing",
        date: i.dueDate,
      })),
      ...(lowStockMaterials as any[]).map((m: any) => ({
        id: "stock-" + m.id,
        type: "low_stock",
        icon: "stock",
        title: "Low Stock Alert",
        body: `${m.itemName}: only ${m.stockQuantity} ${m.unit || "units"} left (min ${m.minStockLevel}).`,
        href: "/materials",
        date: null,
      })),
      ...(upcomingMilestones as any[]).map((m: any) => ({
        id: "mile-" + m.id,
        type: "upcoming_milestone",
        icon: "milestone",
        title: "Upcoming Milestone",
        body: `"${m.name}" in ${m.project?.name || "a project"} is due within 7 days.`,
        href: "/projects",
        date: m.dueDate,
      })),
      ...(persisted as any[]).map((n: any) => ({
        id: n._id.toString(),
        persisted: true,
        type: "alert-" + n.type,
        icon: n.type === "success" ? "milestone" : "warning",
        title: n.title,
        body: n.message,
        href: "/dashboard",
        date: n.createdAt,
      })),
    ];

    return ok({ notifications, count: notifications.length });
  } catch (e) {
    return handleApiError(e);
  }
}
