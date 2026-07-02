import { NextRequest } from "next/server";
import { requireAuth, handleApiError, ok } from "@/lib/api-helpers";
import { connectDB } from "@/lib/mongoose";
import Project from "@/models/Project";
import Client from "@/models/Client";
import Vendor from "@/models/Vendor";
import Employee from "@/models/Employee";
import Task from "@/models/Task";
import Contract from "@/models/Contract";

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth();
    const q = new URL(req.url).searchParams.get("q")?.trim() || "";
    if (q.length < 2) return ok([]);
    await connectDB();
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = { $regex: escaped, $options: "i" };

    // Managers only get search hits for projects/tasks they're actually
    // assigned to — matching the scoping already applied on the Projects
    // and Tasks list pages, instead of leaking every project/task title.
    let projectScope: any = {};
    if (session.user.role === "manager") {
      const myProjects = await Project.find({ assignedManagerId: session.user.id }, { _id: 1 });
      projectScope = { _id: { $in: myProjects.map((p) => p._id) } };
    }
    const taskProjectScope = projectScope._id ? { projectId: projectScope._id } : {};

    const [projects, clients, vendors, employees, tasks, contracts] = await Promise.all([
      Project.find({ ...projectScope, $or: [{ name: re }, { description: re }] }, { name: 1, status: 1 }).limit(5),
      Client.find({ $or: [{ name: re }, { email: re }, { phone: re }] }, { name: 1, email: 1 }).limit(5),
      Vendor.find({ $or: [{ name: re }, { category: re }] }, { name: 1, category: 1 }).limit(5),
      Employee.find({ $or: [{ name: re }, { email: re }, { role: re }, { department: re }] }, { name: 1, role: 1 }).limit(5),
      Task.find({ ...taskProjectScope, $or: [{ title: re }, { description: re }] }, { title: 1, status: 1, projectId: 1 }).limit(5),
      Contract.find({ $or: [{ title: re }, { contractNumber: re }] }, { title: 1, contractNumber: 1 }).limit(5),
    ]);

    const results = [
      ...projects.map((r) => ({ type: "Project", id: r.id, name: r.name, detail: r.status.replace(/_/g, " "), href: `/projects/${r.id}` })),
      ...clients.map((r) => ({ type: "Client", id: r.id, name: r.name, detail: r.email || "", href: "/clients" })),
      ...vendors.map((r) => ({ type: "Vendor", id: r.id, name: r.name, detail: r.category || "", href: "/vendors" })),
      ...employees.map((r) => ({ type: "Employee", id: r.id, name: r.name, detail: r.role || "", href: "/employees" })),
      ...tasks.map((r) => ({ type: "Task", id: r.id, name: r.title, detail: r.status.replace(/_/g, " "), href: "/tasks" })),
      ...contracts.map((r) => ({ type: "Contract", id: r.id, name: r.title, detail: r.contractNumber || "", href: "/contracts" })),
    ];

    return ok(results);
  } catch (e) {
    return handleApiError(e);
  }
}
