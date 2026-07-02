import { requireAuth, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Task from "@/models/Task";
import Invoice from "@/models/Invoice";
import Material from "@/models/Material";
import Milestone from "@/models/Milestone";
import Project from "@/models/Project";
import Notification from "@/models/Notification";
import DismissedAlert from "@/models/DismissedAlert";

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

    const [
      overdueTasks,
      overdueInvoices,
      lowStockMaterials,
      upcomingMilestones,
      dbNotifications,
      dismissedAlerts,
    ] = await Promise.all([
      isOps
        ? Task.find({ ...projectFilter, status: { $ne: "completed" }, dueDate: { $lt: now } }, { title: 1, dueDate: 1, projectId: 1 })
            .populate("project", "name")
            .sort({ dueDate: 1 })
            .limit(10)
            .lean({ virtuals: true })
        : Promise.resolve([]),
      isFinance
        ? Invoice.find({ status: { $in: ["sent", "overdue"] }, dueDate: { $lt: now }, deletedAt: null }, { invoiceNumber: 1, dueDate: 1, grandTotal: 1, projectId: 1 })
            .populate("client", "name")
            .sort({ dueDate: 1 })
            .limit(10)
            .lean({ virtuals: true })
        : Promise.resolve([]),
      isOps
        ? Material.find({ ...projectFilter, $expr: { $lte: ["$stockQuantity", "$minStockLevel"] } }, { itemName: 1, stockQuantity: 1, minStockLevel: 1, unit: 1, projectId: 1 })
            .limit(10)
            .lean()
        : Promise.resolve([]),
      isOps
        ? Milestone.find({ ...projectFilter, completedAt: null, dueDate: { $lte: in7Days, $gte: now } }, { name: 1, dueDate: 1, projectId: 1 })
            .populate("project", "name")
            .sort({ dueDate: 1 })
            .limit(10)
            .lean({ virtuals: true })
        : Promise.resolve([]),
      Notification.find({ userId: userId, isRead: false }).sort({ createdAt: -1 }).limit(30).lean(),
      DismissedAlert.find({ userId: userId }).lean(),
    ]);

    // Build a lookup set of dismissed alert keys (Issue #91)
    const dismissedKeys = new Set(dismissedAlerts.map((d: any) => d.alertKey));

    // Dynamic router utility for database notifications (Issue #92)
    const getNotificationHref = (n: any): string => {
      const title = (n.title || "").toLowerCase();
      const message = (n.message || "").toLowerCase();
      if (title.includes("invoice") || message.includes("invoice") || title.includes("billing") || title.includes("payment")) {
        return "/billing";
      }
      if (title.includes("task") || message.includes("task")) {
        return "/tasks";
      }
      if (title.includes("project") || message.includes("project") || title.includes("milestone") || message.includes("milestone")) {
        return "/projects";
      }
      if (title.includes("material") || message.includes("material") || title.includes("stock") || title.includes("inventory")) {
        return "/materials";
      }
      if (title.includes("employee") || message.includes("employee") || title.includes("salary") || message.includes("salary")) {
        return "/employees";
      }
      return "/dashboard";
    };

    const notifications: any[] = [];

    // 1. Process Database Notifications
    dbNotifications.forEach((n: any) => {
      const key = n._id.toString();
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: n.type || "info",
          icon: n.type === "warning" || n.type === "alert" ? "warning" : "info",
          title: n.title,
          body: n.message,
          href: getNotificationHref(n), // Resolved dynamically (Issue #92)
          date: n.createdAt,
        });
      }
    });

    // 2. Process Overdue Tasks
    overdueTasks.forEach((t: any) => {
      const key = "task-" + t.id;
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: "overdue_task",
          icon: "warning",
          title: "Overdue Task",
          body: `"${t.title}" in ${t.project?.name || "a project"} is past its due date.`,
          href: t.projectId ? `/tasks?projectId=${t.projectId}` : "/tasks",
          date: t.dueDate,
        });
      }
    });

    // 3. Process Overdue Invoices
    overdueInvoices.forEach((i: any) => {
      const key = "inv-" + i.id;
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: "overdue_invoice",
          icon: "invoice",
          title: "Unpaid Invoice",
          body: `Invoice ${i.invoiceNumber} from ${i.client?.name || "client"} — PKR ${(i.grandTotal || 0).toLocaleString()} overdue.`,
          href: "/billing",
          date: i.dueDate,
        });
      }
    });

    // 4. Process Low Stock Materials
    lowStockMaterials.forEach((m: any) => {
      const key = "stock-" + m.id;
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: "low_stock",
          icon: "stock",
          title: "Low Stock Alert",
          body: `${m.itemName}: only ${m.stockQuantity} ${m.unit || "units"} left (min ${m.minStockLevel}).`,
          href: m.projectId ? `/materials?projectId=${m.projectId}` : "/materials",
          date: null,
        });
      }
    });

    // 5. Process Upcoming Milestones
    upcomingMilestones.forEach((m: any) => {
      const key = "mile-" + m.id;
      if (!dismissedKeys.has(key)) {
        notifications.push({
          id: key,
          type: "upcoming_milestone",
          icon: "milestone",
          title: "Upcoming Milestone",
          body: `"${m.name}" in ${m.project?.name || "a project"} is due within 7 days.`,
          href: m.projectId ? `/projects?id=${m.projectId}` : "/projects",
          date: m.dueDate,
        });
      }
    });

    return ok({ notifications, count: notifications.length });
  } catch (e) {
    return handleApiError(e);
  }
}
