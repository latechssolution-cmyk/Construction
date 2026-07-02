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

    let projectFilter: any = { $or: [{ name: re }, { description: re }] };
    let taskFilter: any = { $or: [{ title: re }, { description: re }] };
    let contractFilter: any = { $or: [{ title: re }, { contractNumber: re }] };

    if (session.user.role === "manager") {
      const myProjects = await Project.find({ assignedManagerId: session.user.id }, { _id: 1, contractId: 1 });
      const myIds = myProjects.map((p) => p._id);
      const contractIds = myProjects.map((p) => p.contractId).filter(Boolean);

      projectFilter.assignedManagerId = session.user.id;
      taskFilter.projectId = { $in: myIds };
      contractFilter._id = { $in: contractIds };
    }

    const [projects, clients, vendors, employees, tasks, contracts] = await Promise.all([
      Project.find(projectFilter, { name: 1, status: 1 }).limit(5),
      Client.find({ $or: [{ name: re }, { email: re }, { phone: re }] }, { name: 1, email: 1 }).limit(5),
      Vendor.find({ $or: [{ name: re }, { category: re }] }, { name: 1, category: 1 }).limit(5),
      Employee.find({ $or: [{ name: re }, { email: re }, { role: re }, { department: re }] }, { name: 1, role: 1 }).limit(5),
      Task.find(taskFilter, { title: 1, status: 1, projectId: 1 }).limit(5),
      Contract.find(contractFilter, { title: 1, contractNumber: 1 }).limit(5),
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
