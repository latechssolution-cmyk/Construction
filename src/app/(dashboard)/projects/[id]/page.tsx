"use client";
import useSWR from "swr";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, X, Download, FileText, BarChart2, Boxes, Wallet, HardHat, FolderOpen, Users, CheckCircle2, Circle, Upload, HandCoins, Search } from "lucide-react";
import { TENDER_DOC_CHECKLIST, DOCUMENT_CATEGORY_LABELS } from "@/lib/document-categories";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const PROJECT_STATUSES = ["planning", "ongoing", "physically_closed", "financially_closed", "sick", "cancelled"];
const PROJECT_TYPES = ["residential", "commercial", "industrial", "renovation", "infrastructure", "other"];

const TABS = ["Overview", "Contract", "Phases & Tasks", "Materials", "Team", "Finance", "Billing", "Documents", "Milestones", "Report"];
const CONTRACT_STATUSES = ["draft", "active", "on_hold", "completed", "cancelled", "terminated"];
const INVOICE_STATUS_COLORS: Record<string, string> = { draft: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", paid: "bg-green-100 text-green-700", overdue: "bg-red-100 text-red-700", cancelled: "bg-orange-100 text-orange-700" };
const STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700", in_progress: "bg-blue-100 text-blue-800", on_hold: "bg-yellow-100 text-yellow-800", completed: "bg-green-100 text-green-800",
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const { toast } = useToast();
  const role = session?.user?.role || "";
  const canManage = ["admin", "ceo", "manager"].includes(role);

  const [tab, setTab] = useState("Overview");
  const [taskForm, setTaskForm] = useState<any>({});
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState<any>({});
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [materialForm, setMaterialForm] = useState<any>({});
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  const [editMaterialForm, setEditMaterialForm] = useState<any>({});
  const [deletingMaterialId, setDeletingMaterialId] = useState<string | null>(null);
  const [editingMilestoneId, setEditingMilestoneId] = useState<string | null>(null);
  const [editMilestoneForm, setEditMilestoneForm] = useState<any>({});
  const [deletingMilestoneId, setDeletingMilestoneId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskForm, setEditTaskForm] = useState<any>({});
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamForm, setTeamForm] = useState<any>({});
  const [teamLoading, setTeamLoading] = useState(false);
  const [showPhaseForm, setShowPhaseForm] = useState(false);
  const [phaseForm, setPhaseForm] = useState<any>({});
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editPhaseName, setEditPhaseName] = useState("");
  const [ledgerForm, setLedgerForm] = useState<any>({ type: "expense", category: "" });
  const [showLedgerForm, setShowLedgerForm] = useState(false);
  const [ledgerError, setLedgerError] = useState("");
  const [editingLedgerId, setEditingLedgerId] = useState<string | null>(null);
  const [editLedgerForm, setEditLedgerForm] = useState<any>({});
  const [deletingLedgerId, setDeletingLedgerId] = useState<string | null>(null);
  const [showLinkContractForm, setShowLinkContractForm] = useState(false);
  const [linkContractForm, setLinkContractForm] = useState<any>({});
  const [contractError, setContractError] = useState("");
  const [editingContract, setEditingContract] = useState(false);
  const [editContractForm, setEditContractForm] = useState<any>({});
  const [contractSubTab, setContractSubTab] = useState<"client" | "subcontractors">("client");
  const [showSubcontractForm, setShowSubcontractForm] = useState(false);
  const [subcontractForm, setSubcontractForm] = useState<any>({});
  const [subcontractError, setSubcontractError] = useState("");
  const [editingSubcontractId, setEditingSubcontractId] = useState<string | null>(null);
  const [editSubcontractForm, setEditSubcontractForm] = useState<any>({});
  const [deletingSubcontractId, setDeletingSubcontractId] = useState<string | null>(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<any>({ status: "draft", taxPercent: 0 });
  const [invoiceItems, setInvoiceItems] = useState([{ description: "", quantity: 1, unitPrice: 0 }]);
  const [invoiceError, setInvoiceError] = useState("");
  const [paidInvoiceModal, setPaidInvoiceModal] = useState<any>(null);
  const [paidInvoiceBankId, setPaidInvoiceBankId] = useState("");
  const [showVariationForm, setShowVariationForm] = useState(false);
  const [variationForm, setVariationForm] = useState<any>({});
  const [variationError, setVariationError] = useState("");
  const [showInvestmentForm, setShowInvestmentForm] = useState(false);
  const [investmentForm, setInvestmentForm] = useState<any>({});
  const [investmentError, setInvestmentError] = useState("");

  // Within-project search bars (Materials, Documents, Finance/Ledger tabs)
  const [materialSearch, setMaterialSearch] = useState("");
  const [documentSearch, setDocumentSearch] = useState("");
  const [ledgerSearch, setLedgerSearch] = useState("");

  // Tender/contract document checklist upload (which category slot is open)
  const [docUploadCategory, setDocUploadCategory] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [docUploading, setDocUploading] = useState(false);

  // Inline editing of project details
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState<any>({});

  const { data: project, mutate } = useSWR(`/api/projects/${id}`, fetcher);
  const { data: summary, mutate: mutateSummary } = useSWR(`/api/projects/${id}/summary`, fetcher);
  const { data: variations, mutate: mutateVariations } = useSWR(
    project?.contract?.id ? `/api/contracts/${project.contract.id}/variations` : null,
    fetcher
  );
  const { data: investments, mutate: mutateInvestments } = useSWR(`/api/investments?projectId=${id}`, fetcher);
  const canManageFinanceForInvestments = ["admin", "ceo", "accountant"].includes(role);
  const { data: partnersList } = useSWR(canManageFinanceForInvestments ? "/api/partners" : null, fetcher);
  const { data: vendors } = useSWR("/api/vendors", fetcher);
  const { data: clients } = useSWR(canManage ? "/api/clients" : null, fetcher);
  const { data: managers } = useSWR(canManage ? "/api/users/assignable" : null, fetcher);
  const { data: employeesList } = useSWR(canManage ? "/api/employees?limit=500" : null, fetcher);
  const canManageFinance = ["admin", "ceo", "accountant"].includes(role);
  const canReverseFinance = ["admin", "ceo"].includes(role);
  const { data: bankAccounts } = useSWR(canManageFinance ? "/api/bank-accounts" : null, fetcher);

  // Seed the edit form whenever we enter edit mode / project loads
  useEffect(() => {
    if (project && !project.error) {
      setEdit({
        name: project.name ?? "",
        status: project.status ?? "planning",
        type: project.type ?? "residential",
        location: project.location ?? "",
        budget: project.budget ?? 0,
        caValue: project.caValue ?? 0,
        salients: project.salients ?? "",
        startDate: project.startDate ? project.startDate.slice(0, 10) : "",
        endDate: project.endDate ? project.endDate.slice(0, 10) : "",
        clientId: project.clientId ?? "",
        assignedManagerId: project.assignedManagerId ?? "",
        description: project.description ?? "",
      });
    }
  }, [project?.id, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!project) return <div className="p-6 text-gray-500">Loading project...</div>;
  if (project.error) return <div className="p-6 text-red-500">Project not found</div>;

  async function saveProject(extra?: any) {
    const payload = extra ?? edit;
    if (payload.budget !== undefined && payload.budget !== "" && parseFloat(payload.budget) < 0) {
      toast({ title: "Validation Error", description: "Budget cannot be negative.", variant: "destructive" });
      return;
    }
    const start = payload.startDate !== undefined ? payload.startDate : (project.startDate ? project.startDate.slice(0, 10) : "");
    const end = payload.endDate !== undefined ? payload.endDate : (project.endDate ? project.endDate.slice(0, 10) : "");
    if (start && end && new Date(end) < new Date(start)) {
      toast({ title: "Validation Error", description: "End date cannot be before start date.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: err.error || "Failed to save changes", variant: "destructive" });
        return;
      }
      await mutate();
      await mutateSummary();
      if (!extra) setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  // Use the server-side aggregate totals from /summary rather than summing
  // the (at most 50) ledger entries embedded in the project payload — once
  // a project has more than 50 entries those two numbers would otherwise
  // silently disagree.
  const income = summary?.income ?? 0;
  const expense = summary?.expense ?? 0;

  // Upload a document into a specific tender/contract category slot for this
  // project. Reuses the same Cloudinary signed-upload flow as /documents.
  async function uploadProjectDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!docUploadCategory) return;
    if (!docFile && !docName.trim()) { toast({ title: "Validation", description: "Attach a file or enter a name.", variant: "destructive" }); return; }
    setDocUploading(true);
    try {
      let fileUrl: string | null = null;
      let fileType: string | null = docFile?.type || null;
      let fileSize: number | null = docFile?.size || null;
      if (docFile) {
        const signRes = await fetch("/api/upload");
        if (!signRes.ok) { toast({ title: "Error", description: "Could not get upload token", variant: "destructive" }); return; }
        const { signature, timestamp, apiKey, cloudName, folder, maxFileSize } = await signRes.json();
        if (maxFileSize && docFile.size > maxFileSize) { toast({ title: "Error", description: `File too large (max ${Math.round(maxFileSize / 1024 / 1024)}MB)`, variant: "destructive" }); return; }
        const fd = new FormData();
        fd.append("file", docFile); fd.append("api_key", apiKey); fd.append("timestamp", timestamp);
        fd.append("folder", folder); fd.append("max_file_size", String(maxFileSize)); fd.append("signature", signature);
        const upRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, { method: "POST", body: fd });
        if (!upRes.ok) { toast({ title: "Error", description: "File upload failed", variant: "destructive" }); return; }
        const json = await upRes.json();
        fileUrl = json.secure_url || null; fileSize = json.bytes || fileSize;
      }
      const name = docName.trim() || (DOCUMENT_CATEGORY_LABELS[docUploadCategory] || docFile?.name || "Document");
      const res = await fetch("/api/documents", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, category: docUploadCategory, projectId: id, fileUrl, fileType, fileSize, type: "other" }),
      });
      if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to save document", variant: "destructive" }); return; }
      toast({ title: "Document uploaded" });
      setDocUploadCategory(null); setDocFile(null); setDocName("");
      await mutate();
    } finally { setDocUploading(false); }
  }

  async function deleteProjectDocument(docId: string) {
    const res = await fetch(`/api/documents/${docId}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to delete", variant: "destructive" }); return; }
    toast({ title: "Document deleted" });
    await mutate();
  }

  async function createTask(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${id}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(taskForm),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to create task", variant: "destructive" }); return; }
    mutate();
    setShowTaskForm(false);
    setTaskForm({});
  }

  async function updateTask(taskId: string, updates: any) {
    // Optimistic update: patch the task in the local cache immediately so
    // the checkbox flips on click, instead of waiting for a full re-fetch of
    // the whole project payload (materials, ledger, invoices, documents,
    // subcontracts, ...) just to reflect one task's status. Falls back to a
    // real refetch on error to undo the optimistic change.
    mutate((current: any) => {
      if (!current) return current;
      const patchTask = (t: any) => (t.id === taskId ? { ...t, ...updates } : t);
      return {
        ...current,
        tasks: (current.tasks || []).map(patchTask),
        phases: (current.phases || []).map((ph: any) => ({ ...ph, tasks: (ph.tasks || []).map(patchTask) })),
      };
    }, { revalidate: false });

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to update task", variant: "destructive" });
      mutate();
      return;
    }
    mutate();
  }

  async function deleteTask(taskId: string) {
    const res = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (res.ok) {
      mutate();
      setDeletingTaskId(null);
      toast({ title: "Task deleted" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to delete task", variant: "destructive" });
    }
  }

  async function createPhase(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${id}/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(phaseForm),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to create phase", variant: "destructive" }); return; }
    mutate();
    setShowPhaseForm(false);
    setPhaseForm({});
  }

  async function renamePhase(phaseId: string) {
    if (!editPhaseName.trim()) { setEditingPhaseId(null); return; }
    const res = await fetch(`/api/phases/${phaseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editPhaseName.trim() }),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to rename phase", variant: "destructive" }); return; }
    mutate();
    setEditingPhaseId(null);
  }

  async function deletePhase(phaseId: string) {
    const res = await fetch(`/api/phases/${phaseId}`, { method: "DELETE" });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to delete phase", variant: "destructive" }); return; }
    mutate();
    toast({ title: "Phase deleted" });
  }

  async function createMilestone(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/projects/${id}/milestones`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(milestoneForm),
    });
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to create milestone", variant: "destructive" }); return; }
    mutate();
    setShowMilestoneForm(false);
    setMilestoneForm({});
  }

  async function toggleMilestone(m: any) {
    const optimisticCompletedAt = m.completedAt ? null : new Date().toISOString();
    // Same optimistic-update reasoning as updateTask() above — flip it in
    // the local cache immediately, don't block the checkbox on a full
    // project refetch.
    mutate((current: any) => {
      if (!current) return current;
      return {
        ...current,
        milestones: (current.milestones || []).map((x: any) => (x.id === m.id ? { ...x, completedAt: optimisticCompletedAt } : x)),
      };
    }, { revalidate: false });

    const res = await fetch(`/api/milestones/${m.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      // Only send completed flag — do NOT spread the whole object to avoid overwriting fields
      body: JSON.stringify({ completed: !m.completedAt }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to update milestone", variant: "destructive" });
      mutate();
      return;
    }
    mutate();
  }

  async function createMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (parseFloat(materialForm.unitPrice) <= 0) { toast({ title: "Error", description: "Unit price must be greater than 0", variant: "destructive" }); return; }
    if (parseFloat(materialForm.quantity) < 0) { toast({ title: "Error", description: "Quantity cannot be negative", variant: "destructive" }); return; }
    if (materialForm.minStockLevel !== undefined && materialForm.minStockLevel !== "" && parseFloat(materialForm.minStockLevel) < 0) { toast({ title: "Error", description: "Min stock level cannot be negative", variant: "destructive" }); return; }
    const res = await fetch("/api/materials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...materialForm, projectId: id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to add material", variant: "destructive" });
      return;
    }
    mutate();
    setShowMaterialForm(false);
    setMaterialForm({});
    toast({ title: "Material added" });
  }

  async function deleteMaterial(materialId: string) {
    const res = await fetch(`/api/materials/${materialId}`, { method: "DELETE" });
    if (res.ok) {
      mutate();
      setDeletingMaterialId(null);
      toast({ title: "Material removed" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to delete material", variant: "destructive" });
    }
  }

  async function updateMaterial(e: React.FormEvent, materialId: string) {
    e.preventDefault();
    if (editMaterialForm.unitPrice !== undefined && parseFloat(editMaterialForm.unitPrice) <= 0) { toast({ title: "Error", description: "Unit price must be greater than 0", variant: "destructive" }); return; }
    if (editMaterialForm.quantity !== undefined && parseFloat(editMaterialForm.quantity) < 0) { toast({ title: "Error", description: "Quantity cannot be negative", variant: "destructive" }); return; }
    if (editMaterialForm.stockQuantity !== undefined && editMaterialForm.stockQuantity !== "" && parseFloat(editMaterialForm.stockQuantity) < 0) { toast({ title: "Error", description: "Stock quantity cannot be negative", variant: "destructive" }); return; }
    if (editMaterialForm.minStockLevel !== undefined && editMaterialForm.minStockLevel !== "" && parseFloat(editMaterialForm.minStockLevel) < 0) { toast({ title: "Error", description: "Min stock level cannot be negative", variant: "destructive" }); return; }
    const res = await fetch(`/api/materials/${materialId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editMaterialForm),
    });
    if (res.ok) {
      mutate();
      setEditingMaterialId(null);
      setEditMaterialForm({});
      toast({ title: "Material updated" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to update material", variant: "destructive" });
    }
  }

  const LEDGER_CATEGORIES = ["material_purchase", "salary", "maintenance", "invoice_payment", "client_payment", "vendor_payment", "utility", "overhead", "advance", "other"];

  async function createLedgerEntry(e: React.FormEvent) {
    e.preventDefault();
    setLedgerError("");
    if (!ledgerForm.description?.trim()) { setLedgerError("Description is required."); return; }
    if (!ledgerForm.amount || parseFloat(ledgerForm.amount) <= 0) { setLedgerError("Enter a valid positive amount."); return; }
    if (!ledgerForm.date) { setLedgerError("Date is required."); return; }
    if (!ledgerForm.category?.trim()) { setLedgerError("Category is required."); return; }
    const res = await fetch("/api/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...ledgerForm, amount: parseFloat(ledgerForm.amount), projectId: id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setLedgerError(err.error || "Failed to add entry");
      return;
    }
    mutate();
    mutateSummary();
    setShowLedgerForm(false);
    setLedgerForm({ type: "expense", category: "" });
    toast({ title: "Ledger entry added" });
  }

  function startEditLedger(entry: any) {
    setEditingLedgerId(entry.id);
    setEditLedgerForm({
      date: entry.date ? new Date(entry.date).toISOString().slice(0, 10) : "",
      type: entry.type,
      amount: entry.amount,
      category: entry.category || "",
      description: entry.description || "",
      referenceNumber: entry.referenceNumber || "",
      bankAccountId: entry.bankAccountId || entry.bankAccount?.id || "",
      vendorId: entry.vendorId || entry.vendor?.id || "",
      partyName: entry.partyName || "",
    });
  }

  async function updateLedgerEntry(e: React.FormEvent, entryId: string) {
    e.preventDefault();
    if (editLedgerForm.amount !== undefined && parseFloat(editLedgerForm.amount) <= 0) { toast({ title: "Error", description: "Amount must be greater than 0", variant: "destructive" }); return; }
    const res = await fetch(`/api/ledger/${entryId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editLedgerForm),
    });
    if (res.ok) {
      mutate();
      mutateSummary();
      setEditingLedgerId(null);
      setEditLedgerForm({});
      toast({ title: "Ledger entry updated" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to update entry", variant: "destructive" });
    }
  }

  async function deleteLedgerEntry(entryId: string) {
    // Uses the reversal endpoint (creates a balancing compensating entry
    // instead of hard-deleting) so the audit trail and bank balance history
    // stay intact — same mechanism the general Payments page relies on.
    const res = await fetch(`/api/payments/${entryId}`, { method: "DELETE" });
    if (res.ok) {
      mutate();
      mutateSummary();
      setDeletingLedgerId(null);
      toast({ title: "Ledger entry reversed" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to reverse entry", variant: "destructive" });
    }
  }

  async function linkNewContract(e: React.FormEvent) {
    e.preventDefault();
    setContractError("");
    if (!linkContractForm.title?.trim()) { setContractError("Title is required."); return; }
    const clientId = linkContractForm.clientId || project.clientId;
    if (!clientId) { setContractError("This project has no client set. Set a client on the Overview tab first."); return; }
    const res = await fetch("/api/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...linkContractForm, clientId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setContractError(err.error || "Failed to create contract");
      return;
    }
    const newContract = await res.json();
    const linkRes = await fetch(`/api/projects/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contractId: newContract.data?.id || newContract.id }),
    });
    if (!linkRes.ok) {
      const err = await linkRes.json().catch(() => ({}));
      setContractError(err.error || "Contract was created but could not be linked to this project");
      return;
    }
    mutate();
    setShowLinkContractForm(false);
    setLinkContractForm({});
    toast({ title: "Contract linked to project" });
  }

  function startEditContract() {
    setEditContractForm({
      title: project.contract.title || "",
      scope: project.contract.scope || "",
      contractValue: project.contract.contractValue ?? 0,
      startDate: project.contract.startDate ? new Date(project.contract.startDate).toISOString().slice(0, 10) : "",
      endDate: project.contract.endDate ? new Date(project.contract.endDate).toISOString().slice(0, 10) : "",
      paymentTerms: project.contract.paymentTerms || "",
      notes: project.contract.notes || "",
    });
    setEditingContract(true);
  }

  async function saveContract(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(`/api/contracts/${project.contract.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editContractForm),
    });
    if (res.ok) {
      mutate();
      setEditingContract(false);
      toast({ title: "Contract updated" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to update contract", variant: "destructive" });
    }
  }

  async function changeContractStatus(status: string) {
    const res = await fetch(`/api/contracts/${project.contract.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      mutate();
      toast({ title: `Contract status updated to "${status}"` });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to change contract status", variant: "destructive" });
    }
  }

  async function createVariation(e: React.FormEvent) {
    e.preventDefault();
    setVariationError("");
    if (!variationForm.title?.trim()) { setVariationError("Title is required."); return; }
    const valueChange = parseFloat(variationForm.valueChange || "0");
    if (variationForm.valueChange !== undefined && variationForm.valueChange !== "" && isNaN(valueChange)) {
      setVariationError("Value change must be a number.");
      return;
    }
    const res = await fetch(`/api/contracts/${project.contract.id}/variations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...variationForm, valueChange }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setVariationError(err.error || "Failed to create variation");
      return;
    }
    await mutateVariations();
    setShowVariationForm(false);
    setVariationForm({});
    toast({ title: "Variation order logged" });
  }

  async function setVariationStatus(variationId: string, status: "approved" | "rejected") {
    const res = await fetch(`/api/contracts/${project.contract.id}/variations`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ variationId, status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || `Failed to ${status === "approved" ? "approve" : "reject"} variation`, variant: "destructive" });
      return;
    }
    await mutateVariations();
    toast({ title: `Variation ${status}` });
  }

  async function createInvestment(e: React.FormEvent) {
    e.preventDefault();
    setInvestmentError("");
    if (!investmentForm.partnerId) { setInvestmentError("Select a partner."); return; }
    const amount = parseFloat(investmentForm.amount || "0");
    if (!amount || amount <= 0) { setInvestmentError("Enter an amount greater than 0."); return; }
    const res = await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...investmentForm, amount, projectId: id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setInvestmentError(err.error || "Failed to record investment");
      return;
    }
    await mutateInvestments();
    setShowInvestmentForm(false);
    setInvestmentForm({});
    toast({ title: "Investment recorded" });
  }

  async function deleteInvestment(investmentId: string) {
    const res = await fetch(`/api/investments/${investmentId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to reverse investment", variant: "destructive" });
      return;
    }
    await mutateInvestments();
    toast({ title: "Investment reversed" });
  }

  async function createSubcontract(e: React.FormEvent) {
    e.preventDefault();
    setSubcontractError("");
    if (!subcontractForm.vendorId) { setSubcontractError("Select the vendor/subcontractor being outsourced to."); return; }
    if (!subcontractForm.contractValue || parseFloat(subcontractForm.contractValue) <= 0) { setSubcontractError("Enter a contract value greater than 0."); return; }
    const res = await fetch("/api/subcontracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...subcontractForm, projectId: id }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setSubcontractError(err.error || "Failed to add subcontractor");
      return;
    }
    mutate();
    setShowSubcontractForm(false);
    setSubcontractForm({});
    toast({ title: "Subcontractor added" });
  }

  function startEditSubcontract(sc: any) {
    setEditingSubcontractId(sc.id);
    setEditSubcontractForm({
      contractValue: sc.contractValue,
      scopeOfWork: sc.scopeOfWork || "",
      startDate: sc.startDate ? new Date(sc.startDate).toISOString().slice(0, 10) : "",
      endDate: sc.endDate ? new Date(sc.endDate).toISOString().slice(0, 10) : "",
      notes: sc.notes || "",
    });
  }

  async function updateSubcontract(e: React.FormEvent, scId: string) {
    e.preventDefault();
    if (editSubcontractForm.contractValue !== undefined && parseFloat(editSubcontractForm.contractValue) <= 0) { toast({ title: "Error", description: "Contract value must be greater than 0", variant: "destructive" }); return; }
    const res = await fetch(`/api/subcontracts/${scId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editSubcontractForm),
    });
    if (res.ok) {
      mutate();
      setEditingSubcontractId(null);
      setEditSubcontractForm({});
      toast({ title: "Subcontractor updated" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to update subcontractor", variant: "destructive" });
    }
  }

  async function toggleSubcontractStatus(sc: any) {
    const newStatus = sc.status === "completed" ? "in_progress" : "completed";
    mutate((current: any) => {
      if (!current) return current;
      return {
        ...current,
        subcontracts: (current.subcontracts || []).map((x: any) => (x.id === sc.id ? { ...x, status: newStatus } : x)),
      };
    }, { revalidate: false });

    const res = await fetch(`/api/subcontracts/${sc.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to update status", variant: "destructive" });
      mutate();
      return;
    }
    mutateSummary();
    mutate();
  }

  async function deleteSubcontract(scId: string) {
    const res = await fetch(`/api/subcontracts/${scId}`, { method: "DELETE" });
    if (res.ok) {
      mutate();
      setDeletingSubcontractId(null);
      toast({ title: "Subcontractor removed" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to remove subcontractor", variant: "destructive" });
    }
  }

  function addInvoiceItem() { setInvoiceItems([...invoiceItems, { description: "", quantity: 1, unitPrice: 0 }]); }
  function updateInvoiceItem(idx: number, field: string, val: any) { setInvoiceItems(invoiceItems.map((it, i) => (i === idx ? { ...it, [field]: val } : it))); }
  function removeInvoiceItem(idx: number) { setInvoiceItems(invoiceItems.filter((_, i) => i !== idx)); }

  async function createInvoice(e: React.FormEvent) {
    e.preventDefault();
    setInvoiceError("");
    if (!project.clientId) { setInvoiceError("This project has no client set. Set a client on the Overview tab first."); return; }
    if (invoiceForm.dueDate && invoiceForm.issueDate && new Date(invoiceForm.dueDate) < new Date(invoiceForm.issueDate)) { setInvoiceError("Due date must be after issue date."); return; }
    if (invoiceItems.every((it) => !it.description.trim())) { setInvoiceError("Add at least one line item with a description."); return; }
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...invoiceForm, clientId: project.clientId, projectId: id, items: invoiceItems }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setInvoiceError(err.error || "Failed to create invoice");
      return;
    }
    mutate();
    setShowInvoiceForm(false);
    setInvoiceForm({ status: "draft", taxPercent: 0 });
    setInvoiceItems([{ description: "", quantity: 1, unitPrice: 0 }]);
    toast({ title: "Invoice created" });
  }

  async function markInvoiceSent(invoiceId: string) {
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "sent" }) });
    if (res.ok) { mutate(); toast({ title: "Invoice marked as sent" }); }
    else { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed", variant: "destructive" }); }
  }

  async function confirmInvoicePaid() {
    if (!paidInvoiceModal) return;
    const res = await fetch(`/api/invoices/${paidInvoiceModal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "paid", bankAccountId: paidInvoiceBankId || undefined }),
    });
    if (res.ok) {
      mutate();
      mutateSummary();
      setPaidInvoiceModal(null);
      setPaidInvoiceBankId("");
      toast({ title: "Invoice marked paid" });
    } else {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed", variant: "destructive" });
    }
  }

  async function cancelInvoice(invoiceId: string) {
    const res = await fetch(`/api/invoices/${invoiceId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "cancelled" }) });
    if (res.ok) { mutate(); toast({ title: "Invoice cancelled" }); }
    else { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed", variant: "destructive" }); }
  }

  async function assignEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!teamForm.employeeId) return;
    setTeamLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast({ title: "Error", description: err.error || "Failed to assign employee", variant: "destructive" });
        return;
      }
      mutate();
      setShowTeamForm(false);
      setTeamForm({});
      toast({ title: "Employee assigned" });
    } finally {
      setTeamLoading(false);
    }
  }

  async function removeTeamMember(employeeId: string) {
    const res = await fetch(`/api/projects/${id}/employees?employeeId=${employeeId}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      toast({ title: "Error", description: err.error || "Failed to remove employee", variant: "destructive" });
      return;
    }
    mutate();
    toast({ title: "Employee removed from project" });
  }

  async function downloadReport() {
    const res = await fetch(`/api/projects/${id}/report`);
    if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to generate report", variant: "destructive" }); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `project-report-${project.name}.pdf`;
    a.click();
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/projects" className="hover:text-blue-600">Projects</Link>
            <span>/</span>
            <span className="text-gray-900">{project.name}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-500 mt-1">{project.location} · {project.type} · {project.client?.name}</p>
        </div>
        <div className="flex gap-2">
          {canManage && !editing && (
            <button onClick={() => { setEditing(true); setTab("Overview"); }} className="px-3 py-2 border border-blue-200 text-blue-700 rounded-lg text-sm hover:bg-blue-50">
              <span className="flex items-center gap-1.5"><Pencil className="w-4 h-4" /> Edit Project</span>
            </button>
          )}
          {canManage && editing && (
            <>
              <button onClick={() => saveProject()} disabled={saving} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button onClick={() => setEditing(false)} className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
                Cancel
              </button>
            </>
          )}
          <button onClick={downloadReport} className="px-3 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50">
            <span className="flex items-center gap-1.5"><Download className="w-4 h-4" /> Download Report</span>
          </button>
          <StatusBadge status={project.status} className="px-3 py-2 text-sm" />
        </div>
      </div>

      {/* Completion progress — fully derived from tasks, no manual override */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">Overall Completion</h3>
            <p className="text-xs text-gray-400">
              {summary && typeof summary.totalTasks === "number"
                ? summary.totalTasks > 0
                  ? `Based on ${summary.completedTasks}/${summary.totalTasks} tasks (weighted)`
                  : "No tasks yet — add tasks in the Phases & Tasks tab to track progress"
                : "Based on task completion (weighted)"}
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-600">{Math.round(project.completionPercent || 0)}%</span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-3 rounded-full transition-all ${(project.completionPercent || 0) >= 100 ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${Math.min(project.completionPercent || 0, 100)}%` }}
          />
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Budget", value: `PKR ${summary.budget?.toLocaleString()}`, sub: `${summary.budgetUsedPct || 0}% used`, color: (summary.budgetUsedPct || 0) > 90 ? "text-red-600" : "text-green-600" },
            { label: "Net Profit", value: `PKR ${(summary.profit || 0).toLocaleString()}`, sub: `Inc: ${summary.income?.toLocaleString()}`, color: (summary.profit || 0) >= 0 ? "text-green-600" : "text-red-600" },
            { label: "Task Progress", value: `${summary.taskProgress || 0}%`, sub: `${summary.completedTasks}/${summary.totalTasks} done` },
            { label: "Milestones", value: `${summary.milestoneProgress || 0}%`, sub: `${summary.completedMilestones}/${summary.totalMilestones} complete` },
          ].map((card) => (
            <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-1">{card.label}</p>
              <p className={`text-lg font-bold ${card.color || "text-gray-900"}`}>{card.value}</p>
              <p className="text-xs text-gray-400">{card.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`pb-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-900"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === "Overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
            <h3 className="font-semibold text-gray-900">Project Details</h3>
            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Project Name</label>
                  <input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                    <select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {PROJECT_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
                    <select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Location</label>
                    <input value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">CA Value (PKR)</label>
                    <input type="number" min="0" step="0.01" value={edit.caValue} onChange={(e) => setEdit({ ...edit, caValue: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Contract Agreement value" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Budget (PKR)</label>
                    <input type="number" min="0" step="0.01" value={edit.budget} onChange={(e) => setEdit({ ...edit, budget: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
                    <input type="date" value={edit.startDate} onChange={(e) => setEdit({ ...edit, startDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
                    <input type="date" value={edit.endDate} onChange={(e) => setEdit({ ...edit, endDate: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Client</label>
                    <select value={edit.clientId} onChange={(e) => setEdit({ ...edit, clientId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">— None —</option>
                      {(Array.isArray(clients) ? clients : []).map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Manager</label>
                    <select value={edit.assignedManagerId} onChange={(e) => setEdit({ ...edit, assignedManagerId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">— Unassigned —</option>
                      {(Array.isArray(managers) ? managers : []).filter((m: any) => ["manager", "admin", "ceo"].includes(m.role)).map((m: any) => <option key={m.id} value={m.id}>{m.name} ({m.role})</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Description</label>
                  <textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Salient Features</label>
                  <textarea value={edit.salients} onChange={(e) => setEdit({ ...edit, salients: e.target.value })} rows={4} placeholder="Key project specs / scope highlights (e.g. 4-lane 320m bridge, 200 housing units, 8-story RCC frame…)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            ) : (
              <>
                {[
                  ["Client", project.client?.name],
                  ["Manager", project.assignedManager?.name],
                  ["Type", project.type],
                  ["Start Date", project.startDate ? new Date(project.startDate).toLocaleDateString() : "—"],
                  ["End Date", project.endDate ? new Date(project.endDate).toLocaleDateString() : "—"],
                  ["Contract", project.contract?.contractNumber],
                  ["CA Value", `PKR ${(project.caValue || project.budget || 0).toLocaleString()}`],
                  ["Budget", `PKR ${(project.budget || 0).toLocaleString()}`],
                  ["Completion", `${Math.round(project.completionPercent || 0)}%`],
                ].map(([l, v]) => v && (
                  <div key={l} className="flex justify-between text-sm">
                    <span className="text-gray-500">{l}</span>
                    <span className="font-medium text-gray-900">{v}</span>
                  </div>
                ))}
                {project.salients && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Salient Features</p>
                    <p className="text-sm text-gray-700 whitespace-pre-line">{project.salients}</p>
                  </div>
                )}
                {project.description && <p className="text-sm text-gray-600 mt-3 pt-3 border-t">{project.description}</p>}
              </>
            )}
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Financial Summary</h3>
            <div className="space-y-3">
              {[
                ["Total Income", income, "text-green-600"],
                ["Total Expense", expense, "text-red-600"],
                ["Net Profit", income - expense, income - expense >= 0 ? "text-green-600" : "text-red-600"],
                ["Budget Remaining", (project.budget || 0) - expense, (project.budget || 0) - expense >= 0 ? "text-blue-600" : "text-red-600"],
              ].map(([l, v, c]: any) => (
                <div key={l} className="flex justify-between text-sm">
                  <span className="text-gray-500">{l}</span>
                  <span className={`font-bold ${c}`}>PKR {v.toLocaleString()}</span>
                </div>
              ))}
              {summary && summary.totalSubcontracts > 0 && (
                <div className="flex justify-between text-sm pt-3 mt-1 border-t border-gray-100">
                  <span className="text-gray-500">Subcontracted ({summary.totalSubcontracts})</span>
                  <span className="font-bold text-purple-600">
                    PKR {summary.totalSubcontractValue.toLocaleString()}
                    <span className="text-xs text-gray-400 font-normal ml-1">
                      ({summary.completedSubcontractValue.toLocaleString()} completed)
                    </span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "Contract" && (
        <div className="space-y-4">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            <button
              onClick={() => setContractSubTab("client")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${contractSubTab === "client" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Main Contract
            </button>
            <button
              onClick={() => setContractSubTab("subcontractors")}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${contractSubTab === "subcontractors" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              Subcontractors {(project.subcontracts || []).length > 0 && `(${project.subcontracts.length})`}
            </button>
          </div>

          {contractSubTab === "client" && (<>
          {!project.contract ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<FileText className="w-10 h-10" />} title="No contract linked" hint="Link a new contract to this project to track its value, status, and payment terms here." />
              {canManage && (
                <div className="px-6 pb-6 -mt-2 flex justify-center">
                  <button onClick={() => setShowLinkContractForm(!showLinkContractForm)} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">
                    {showLinkContractForm ? "Cancel" : "+ Create & Link Contract"}
                  </button>
                </div>
              )}
              {showLinkContractForm && canManage && (
                <div className="p-6 pt-0">
                  {contractError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-3">{contractError}</div>}
                  <form onSubmit={linkNewContract} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <input required value={linkContractForm.title || ""} onChange={(e) => setLinkContractForm({ ...linkContractForm, title: e.target.value })} placeholder="Contract title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <input required type="number" min="0" step="0.01" value={linkContractForm.contractValue || ""} onChange={(e) => setLinkContractForm({ ...linkContractForm, contractValue: e.target.value })} placeholder="Contract value (PKR) *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <div className="grid grid-cols-2 gap-3">
                      <input type="date" value={linkContractForm.startDate || ""} onChange={(e) => setLinkContractForm({ ...linkContractForm, startDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      <input type="date" value={linkContractForm.endDate || ""} onChange={(e) => setLinkContractForm({ ...linkContractForm, endDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <textarea value={linkContractForm.scope || ""} onChange={(e) => setLinkContractForm({ ...linkContractForm, scope: e.target.value })} placeholder="Scope of work (optional)" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <input value={linkContractForm.paymentTerms || ""} onChange={(e) => setLinkContractForm({ ...linkContractForm, paymentTerms: e.target.value })} placeholder="Payment terms (optional)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Create & Link</button>
                      <button type="button" onClick={() => { setShowLinkContractForm(false); setLinkContractForm({}); setContractError(""); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          ) : editingContract ? (
            <form onSubmit={saveContract} className="bg-white border border-gray-200 rounded-xl p-6 space-y-3">
              <h3 className="font-semibold text-gray-900">Edit Contract: {project.contract.contractNumber}</h3>
              <input required value={editContractForm.title || ""} onChange={(e) => setEditContractForm({ ...editContractForm, title: e.target.value })} placeholder="Title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div>
                <input
                  type="number" min="0" step="0.01"
                  disabled={project.contract.status !== "draft"}
                  value={editContractForm.contractValue ?? ""}
                  onChange={(e) => setEditContractForm({ ...editContractForm, contractValue: e.target.value })}
                  placeholder="Contract value (PKR)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400"
                />
                {project.contract.status !== "draft" && <p className="text-xs text-gray-400 mt-1">Base value is locked once a contract leaves draft — log a variation order instead.</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" value={editContractForm.startDate || ""} onChange={(e) => setEditContractForm({ ...editContractForm, startDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="date" value={editContractForm.endDate || ""} onChange={(e) => setEditContractForm({ ...editContractForm, endDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <textarea value={editContractForm.scope || ""} onChange={(e) => setEditContractForm({ ...editContractForm, scope: e.target.value })} placeholder="Scope of work" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={editContractForm.paymentTerms || ""} onChange={(e) => setEditContractForm({ ...editContractForm, paymentTerms: e.target.value })} placeholder="Payment terms" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <textarea value={editContractForm.notes || ""} onChange={(e) => setEditContractForm({ ...editContractForm, notes: e.target.value })} placeholder="Notes" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Save</button>
                <button type="button" onClick={() => setEditingContract(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          ) : (
            <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-mono">{project.contract.contractNumber}</p>
                  <h3 className="font-semibold text-gray-900 text-lg">{project.contract.title}</h3>
                </div>
                <div className="flex items-center gap-2">
                  {canManage && CONTRACT_STATUSES.filter((s) => s !== project.contract.status).length > 0 && (
                    <select
                      value=""
                      onChange={(e) => e.target.value && changeContractStatus(e.target.value)}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1"
                    >
                      <option value="">Change status…</option>
                      {CONTRACT_STATUSES.filter((s) => s !== project.contract.status).map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                    </select>
                  )}
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize bg-blue-100 text-blue-700">{project.contract.status?.replace(/_/g, " ")}</span>
                  {canManage && <button onClick={startEditContract} className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg" title="Edit"><Pencil className="w-4 h-4" /></button>}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs text-blue-700 mb-1">Base Value</p>
                  <p className="text-lg font-bold text-blue-800">PKR {(project.contract.contractValue || 0).toLocaleString()}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">Start Date</p>
                  <p className="text-sm font-medium text-gray-800">{project.contract.startDate ? new Date(project.contract.startDate).toLocaleDateString() : "—"}</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">End Date</p>
                  <p className="text-sm font-medium text-gray-800">{project.contract.endDate ? new Date(project.contract.endDate).toLocaleDateString() : "—"}</p>
                </div>
              </div>
              {project.contract.scope && <div><p className="text-xs text-gray-400 mb-1">Scope of Work</p><p className="text-sm text-gray-700">{project.contract.scope}</p></div>}
              {project.contract.paymentTerms && <div><p className="text-xs text-gray-400 mb-1">Payment Terms</p><p className="text-sm text-gray-700">{project.contract.paymentTerms}</p></div>}
              {project.contract.notes && <div><p className="text-xs text-gray-400 mb-1">Notes</p><p className="text-sm text-gray-700">{project.contract.notes}</p></div>}
            </div>
          )}

          {/* Contract Variations / Change Orders */}
          {project.contract && !editingContract && (() => {
            const varList: any[] = variations || [];
            const approvedSum = varList.filter((v) => v.status === "approved").reduce((s, v) => s + (v.valueChange || 0), 0);
            const totalValue = (project.contract.contractValue || 0) + approvedSum;
            const canApproveVariation = ["admin", "ceo"].includes(role);
            return (
              <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">Contract Variations</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Base PKR {(project.contract.contractValue || 0).toLocaleString()}
                      {approvedSum !== 0 && <> {approvedSum > 0 ? "+" : "−"} PKR {Math.abs(approvedSum).toLocaleString()} approved = <span className="font-semibold text-gray-600">PKR {totalValue.toLocaleString()}</span></>}
                    </p>
                  </div>
                  {canManage && project.contract.status !== "draft" && (
                    <button onClick={() => { setShowVariationForm(!showVariationForm); setVariationError(""); }} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">
                      {showVariationForm ? "Cancel" : "+ Log Variation"}
                    </button>
                  )}
                </div>

                {project.contract.status === "draft" && (
                  <p className="text-xs text-gray-400">Activate the contract first — variations amend a value that&apos;s still editable directly while in draft.</p>
                )}

                {showVariationForm && (
                  <form onSubmit={createVariation} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    {variationError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">{variationError}</div>}
                    <input required value={variationForm.title || ""} onChange={(e) => setVariationForm({ ...variationForm, title: e.target.value })} placeholder="Title (e.g. Additional foundation works) *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <div>
                      <input type="number" step="0.01" value={variationForm.valueChange ?? ""} onChange={(e) => setVariationForm({ ...variationForm, valueChange: e.target.value })} placeholder="Value change (PKR) — negative for a reduction" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      <p className="text-[11px] text-gray-400 mt-1">Positive adds to the contract value, negative reduces it.</p>
                    </div>
                    <textarea value={variationForm.description || ""} onChange={(e) => setVariationForm({ ...variationForm, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    {canApproveVariation && (
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" checked={variationForm.status === "approved"} onChange={(e) => setVariationForm({ ...variationForm, status: e.target.checked ? "approved" : undefined })} className="accent-blue-600" />
                        Mark as approved immediately
                      </label>
                    )}
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Log Variation</button>
                      <button type="button" onClick={() => { setShowVariationForm(false); setVariationForm({}); setVariationError(""); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
                    </div>
                  </form>
                )}

                {varList.length === 0 ? (
                  <p className="text-sm text-gray-400">No variation orders logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {varList.map((v) => (
                      <div key={v.id} className="border border-gray-100 rounded-lg p-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-gray-900">{v.title}</p>
                            <StatusBadge status={v.status} />
                          </div>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{v.variationNumber}</p>
                          {v.description && <p className="text-xs text-gray-500 mt-1">{v.description}</p>}
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-sm font-semibold ${v.valueChange >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {v.valueChange >= 0 ? "+" : "−"}PKR {Math.abs(v.valueChange).toLocaleString()}
                          </span>
                          {v.status === "pending" && canApproveVariation && (
                            <div className="flex gap-1">
                              <button onClick={() => setVariationStatus(v.id, "approved")} className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg" title="Approve"><CheckCircle2 className="w-4 h-4" /></button>
                              <button onClick={() => setVariationStatus(v.id, "rejected")} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg" title="Reject"><X className="w-4 h-4" /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
          </>)}

          {contractSubTab === "subcontractors" && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-900">Subcontractors</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Parts of this project outsourced to a vendor/subcontractor outside the company.</p>
                </div>
                {canManage && (
                  <button onClick={() => { setShowSubcontractForm(!showSubcontractForm); setEditingSubcontractId(null); setSubcontractError(""); }} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg shrink-0">
                    {showSubcontractForm ? "Cancel" : "+ Add Subcontractor"}
                  </button>
                )}
              </div>

              {subcontractError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{subcontractError}</div>}

              {showSubcontractForm && canManage && (
                <form onSubmit={createSubcontract} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-700">New Subcontractor Agreement</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <select required value={subcontractForm.vendorId || ""} onChange={(e) => setSubcontractForm({ ...subcontractForm, vendorId: e.target.value })} className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Select vendor/subcontractor *</option>
                      {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}{v.category ? ` — ${v.category}` : ""}</option>)}
                    </select>
                    <input required type="number" min="0.01" step="0.01" value={subcontractForm.contractValue || ""} onChange={(e) => setSubcontractForm({ ...subcontractForm, contractValue: e.target.value })} placeholder="Contract value (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <input type="date" value={subcontractForm.startDate || ""} onChange={(e) => setSubcontractForm({ ...subcontractForm, startDate: e.target.value })} placeholder="Start date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <input type="date" value={subcontractForm.endDate || ""} onChange={(e) => setSubcontractForm({ ...subcontractForm, endDate: e.target.value })} placeholder="End date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <textarea value={subcontractForm.scopeOfWork || ""} onChange={(e) => setSubcontractForm({ ...subcontractForm, scopeOfWork: e.target.value })} placeholder="Scope of work outsourced (e.g. electrical wiring, plumbing)" rows={2} className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <textarea value={subcontractForm.notes || ""} onChange={(e) => setSubcontractForm({ ...subcontractForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Add Subcontractor</button>
                    <button type="button" onClick={() => { setShowSubcontractForm(false); setSubcontractForm({}); setSubcontractError(""); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
                  </div>
                </form>
              )}

              {(project.subcontracts || []).length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl">
                  <EmptyState icon={<Users className="w-10 h-10" />} title="No subcontractors on this project" hint="Add a subcontractor when you outsource part of the project's work to an outside vendor." />
                </div>
              ) : (
                <div className="space-y-3">
                  {project.subcontracts.map((sc: any) => (
                    <div key={sc.id} className="bg-white border border-gray-200 rounded-xl p-4">
                      {editingSubcontractId === sc.id ? (
                        <form onSubmit={(e) => updateSubcontract(e, sc.id)} className="space-y-3">
                          <p className="text-sm font-semibold text-blue-700">Editing: {sc.vendor?.name}</p>
                          <div className="grid grid-cols-2 gap-3">
                            <input required type="number" min="0.01" step="0.01" value={editSubcontractForm.contractValue || ""} onChange={(e) => setEditSubcontractForm({ ...editSubcontractForm, contractValue: e.target.value })} placeholder="Contract value *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                            <div />
                            <input type="date" value={editSubcontractForm.startDate || ""} onChange={(e) => setEditSubcontractForm({ ...editSubcontractForm, startDate: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                            <input type="date" value={editSubcontractForm.endDate || ""} onChange={(e) => setEditSubcontractForm({ ...editSubcontractForm, endDate: e.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                            <textarea value={editSubcontractForm.scopeOfWork || ""} onChange={(e) => setEditSubcontractForm({ ...editSubcontractForm, scopeOfWork: e.target.value })} placeholder="Scope of work" rows={2} className="col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                            <textarea value={editSubcontractForm.notes || ""} onChange={(e) => setEditSubcontractForm({ ...editSubcontractForm, notes: e.target.value })} placeholder="Notes" rows={2} className="col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                          </div>
                          <div className="flex gap-2">
                            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">Save</button>
                            <button type="button" onClick={() => { setEditingSubcontractId(null); setEditSubcontractForm({}); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-gray-900">{sc.vendor?.name || "Unknown vendor"}</p>
                                <StatusBadge status={sc.status || "in_progress"} />
                              </div>
                              <p className="text-xs text-gray-500 capitalize">{sc.vendor?.category ? `${sc.vendor.category} · ` : ""}{sc.vendor?.contactPerson || sc.vendor?.phone || "—"}</p>
                            </div>
                            <p className="text-lg font-bold text-gray-900 shrink-0">PKR {(sc.contractValue || 0).toLocaleString()}</p>
                          </div>
                          {sc.scopeOfWork && <p className="text-sm text-gray-700 mt-2">{sc.scopeOfWork}</p>}
                          <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                            {sc.startDate && <span>Start: {new Date(sc.startDate).toLocaleDateString()}</span>}
                            {sc.endDate && <span>End: {new Date(sc.endDate).toLocaleDateString()}</span>}
                            {sc.completedAt && <span>Completed: {new Date(sc.completedAt).toLocaleDateString()}</span>}
                          </div>
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                            {canManage && (
                              <button
                                onClick={() => toggleSubcontractStatus(sc)}
                                className={`text-xs px-2 py-1 rounded-lg border ${sc.status === "completed" ? "border-gray-200 text-gray-600 hover:bg-gray-50" : "border-green-200 text-green-700 hover:bg-green-50"}`}
                              >
                                <span className="flex items-center gap-1">
                                  {sc.status === "completed" ? <><Circle className="w-3 h-3" /> Mark Incomplete</> : <><CheckCircle2 className="w-3 h-3" /> Mark Completed</>}
                                </span>
                              </button>
                            )}
                            {canManage && (
                              <button onClick={() => startEditSubcontract(sc)} className="text-xs px-2 py-1 border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50">
                                <span className="flex items-center gap-1"><Pencil className="w-3 h-3" /> Edit</span>
                              </button>
                            )}
                            {canManage && (
                              deletingSubcontractId === sc.id ? (
                                <div className="flex items-center gap-1">
                                  <button onClick={() => deleteSubcontract(sc.id)} className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg font-medium">Confirm Remove</button>
                                  <button onClick={() => setDeletingSubcontractId(null)} className="text-xs px-1.5 py-1 border border-gray-300 rounded-lg"><X className="w-3 h-3" /></button>
                                </div>
                              ) : (
                                <button onClick={() => setDeletingSubcontractId(sc.id)} className="text-xs px-2 py-1 border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                                  <span className="flex items-center gap-1"><Trash2 className="w-3 h-3" /> Remove</span>
                                </button>
                              )
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === "Phases & Tasks" && (() => {
        const phases: any[] = project.phases || [];
        const unassignedTasks = (project.tasks || []).filter((t: any) => !t.phaseId);
        const renderTask = (task: any) => (
          <div key={task.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
            <input type="checkbox" checked={task.status === "completed"} onChange={() => canManage && updateTask(task.id, { status: task.status === "completed" ? "in_progress" : "completed" })} disabled={!canManage} className="w-4 h-4 accent-blue-600 disabled:opacity-50" />
            <div className="flex-1">
              <p className={`text-sm font-medium ${task.status === "completed" ? "line-through text-gray-400" : "text-gray-900"}`}>{task.title}</p>
              {task.assignedTo && <p className="text-xs text-gray-500">{task.assignedTo.name}</p>}
            </div>
            <div className="flex items-center gap-2">
              {task.dueDate && <span className="text-xs text-gray-400">{new Date(task.dueDate).toLocaleDateString()}</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status] || ""}`}>{task.status?.replace("_"," ")}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${task.priority === "high" ? "bg-red-100 text-red-700" : task.priority === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>{task.priority}</span>
            </div>
          </div>
        );
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Phases</h3>
              {canManage && <button onClick={() => setShowPhaseForm(!showPhaseForm)} className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg">+ Add Phase</button>}
            </div>
            {showPhaseForm && canManage && (
              <form onSubmit={createPhase} className="bg-white border border-gray-200 rounded-xl p-4 flex gap-2">
                <input required value={phaseForm.name || ""} onChange={(e) => setPhaseForm({ name: e.target.value })} placeholder="Phase name (e.g. Foundation, Framing) *" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Add</button>
                <button type="button" onClick={() => setShowPhaseForm(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </form>
            )}

            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Tasks ({(project.tasks || []).length})</h3>
              {canManage && <button onClick={() => setShowTaskForm(!showTaskForm)} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">+ Add Task</button>}
            </div>
            {showTaskForm && canManage && (
              <form onSubmit={createTask} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><input required value={taskForm.title || ""} onChange={(e) => setTaskForm({...taskForm, title: e.target.value})} placeholder="Task title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <select value={taskForm.phaseId || ""} onChange={(e) => setTaskForm({...taskForm, phaseId: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">No phase</option>
                    {phases.map((ph: any) => <option key={ph.id} value={ph.id}>{ph.name}</option>)}
                  </select>
                  <select value={taskForm.priority || "medium"} onChange={(e) => setTaskForm({...taskForm, priority: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                  </select>
                  <input type="date" value={taskForm.dueDate || ""} onChange={(e) => setTaskForm({...taskForm, dueDate: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <div className="col-span-2"><textarea value={taskForm.description || ""} onChange={(e) => setTaskForm({...taskForm, description: e.target.value})} placeholder="Description" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Create</button>
                  <button type="button" onClick={() => setShowTaskForm(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
                </div>
              </form>
            )}

            {phases.map((ph: any) => (
              <div key={ph.id} className="space-y-2">
                <div className="flex items-center gap-2">
                  {editingPhaseId === ph.id ? (
                    <>
                      <input autoFocus value={editPhaseName} onChange={(e) => setEditPhaseName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") renamePhase(ph.id); if (e.key === "Escape") setEditingPhaseId(null); }} className="border border-gray-200 rounded-lg px-2 py-1 text-sm font-medium" />
                      <button onClick={() => renamePhase(ph.id)} className="text-xs text-blue-600 hover:underline">Save</button>
                      <button onClick={() => setEditingPhaseId(null)} className="text-xs text-gray-400 hover:underline">Cancel</button>
                    </>
                  ) : (
                    <>
                      <h4 className="font-medium text-gray-800 text-sm">{ph.name}</h4>
                      <span className="text-xs text-gray-400">({(ph.tasks || []).length} tasks)</span>
                      {canManage && (
                        <>
                          <button onClick={() => { setEditingPhaseId(ph.id); setEditPhaseName(ph.name); }} className="text-xs text-blue-500 hover:underline ml-2">Rename</button>
                          <button onClick={() => deletePhase(ph.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                        </>
                      )}
                    </>
                  )}
                </div>
                <div className="space-y-2 pl-1">
                  {(ph.tasks || []).map((task: any) => renderTask(task))}
                  {(ph.tasks || []).length === 0 && <p className="text-xs text-gray-400 pl-2">No tasks in this phase yet</p>}
                </div>
              </div>
            ))}

            <div className="space-y-2">
              {phases.length > 0 && <h4 className="font-medium text-gray-800 text-sm">Unassigned Tasks</h4>}
              {unassignedTasks.map((task: any) => renderTask(task))}
              {(project.tasks || []).length === 0 && <p className="text-center py-8 text-gray-400 text-sm">No tasks yet</p>}
            </div>
          </div>
        );
      })()}

      {tab === "Milestones" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Milestones ({(project.milestones || []).length})</h3>
            {canManage && (
              <button
                onClick={() => { setShowMilestoneForm(!showMilestoneForm); setEditingMilestoneId(null); }}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg"
              >+ Add Milestone</button>
            )}
          </div>

          {/* Create milestone form */}
          {showMilestoneForm && canManage && (
            <form onSubmit={createMilestone} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">New Milestone</h4>
              <input
                required
                value={milestoneForm.name || ""}
                onChange={(e) => setMilestoneForm({...milestoneForm, name: e.target.value})}
                placeholder="Milestone name *"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <textarea
                value={milestoneForm.description || ""}
                onChange={(e) => setMilestoneForm({...milestoneForm, description: e.target.value})}
                placeholder="Description (optional)"
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
              />
              <input
                type="date"
                value={milestoneForm.dueDate || ""}
                onChange={(e) => setMilestoneForm({...milestoneForm, dueDate: e.target.value})}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Create</button>
                <button type="button" onClick={() => { setShowMilestoneForm(false); setMilestoneForm({}); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {(project.milestones || []).map((m: any) => (
              <div key={m.id}>
                {/* Edit milestone form (inline) */}
                {editingMilestoneId === m.id && canManage ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const res = await fetch(`/api/milestones/${m.id}`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          name: editMilestoneForm.name,
                          description: editMilestoneForm.description || "",
                          dueDate: editMilestoneForm.dueDate || null,
                        }),
                      });
                      if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to update milestone", variant: "destructive" }); return; }
                      mutate();
                      setEditingMilestoneId(null);
                      setEditMilestoneForm({});
                      toast({ title: "Milestone updated" });
                    }}
                    className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3"
                  >
                    <h4 className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Edit Milestone</h4>
                    <input
                      required
                      value={editMilestoneForm.name || ""}
                      onChange={(e) => setEditMilestoneForm({...editMilestoneForm, name: e.target.value})}
                      placeholder="Milestone name *"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <textarea
                      value={editMilestoneForm.description || ""}
                      onChange={(e) => setEditMilestoneForm({...editMilestoneForm, description: e.target.value})}
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none"
                    />
                    <input
                      type="date"
                      value={editMilestoneForm.dueDate || ""}
                      onChange={(e) => setEditMilestoneForm({...editMilestoneForm, dueDate: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium">Save Changes</button>
                      <button type="button" onClick={() => { setEditingMilestoneId(null); setEditMilestoneForm({}); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm">Cancel</button>
                    </div>
                  </form>
                ) : (
                  /* Milestone card */
                  <div className={`bg-white border rounded-xl p-4 ${m.completedAt ? "border-green-200" : "border-gray-200"}`}>
                    <div className="flex items-start gap-3">
                      {/* Toggle complete button */}
                      <button
                        onClick={() => canManage && toggleMilestone(m)}
                        disabled={!canManage}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-colors ${
                          m.completedAt ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-green-400"
                        } disabled:opacity-50 disabled:cursor-not-allowed`}
                        title={m.completedAt ? "Mark as incomplete" : "Mark as complete"}
                      >
                        {m.completedAt && "✓"}
                      </button>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium text-sm ${m.completedAt ? "text-green-800" : "text-gray-900"}`}>{m.name}</p>
                        {m.description && (
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{m.description}</p>
                        )}
                        <div className="flex flex-wrap gap-3 mt-1.5">
                          {m.dueDate && (
                            <span className="text-xs text-gray-400">Due: {new Date(m.dueDate).toLocaleDateString()}</span>
                          )}
                          {m.completedAt && (
                            <span className="text-xs text-green-600 font-medium">✓ Completed {new Date(m.completedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>

                      {/* Edit / Delete controls */}
                      {canManage && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => {
                              setEditingMilestoneId(m.id);
                              setEditMilestoneForm({
                                name: m.name,
                                description: m.description || "",
                                dueDate: m.dueDate ? new Date(m.dueDate).toISOString().slice(0, 10) : "",
                              });
                              setShowMilestoneForm(false);
                            }}
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit milestone"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {deletingMilestoneId === m.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={async () => {
                                  const res = await fetch(`/api/milestones/${m.id}`, { method: "DELETE" });
                                  if (!res.ok) { const err = await res.json().catch(() => ({})); toast({ title: "Error", description: err.error || "Failed to delete", variant: "destructive" }); return; }
                                  mutate();
                                  setDeletingMilestoneId(null);
                                  toast({ title: "Milestone deleted" });
                                }}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded-md font-medium hover:bg-red-700"
                              >Delete</button>
                              <button
                                onClick={() => setDeletingMilestoneId(null)}
                                className="p-1 text-gray-400 hover:text-gray-600 rounded"
                              ><X className="w-3.5 h-3.5" /></button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeletingMilestoneId(m.id)}
                              className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete milestone"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {(project.milestones || []).length === 0 && (
              <p className="text-center py-8 text-gray-400 text-sm">No milestones yet. Add your first milestone above.</p>
            )}
          </div>
        </div>
      )}

      {tab === "Materials" && (() => {
        const filteredMaterials = (project.materials || []).filter((m: any) =>
          !materialSearch ||
          m.itemName?.toLowerCase().includes(materialSearch.toLowerCase()) ||
          m.category?.toLowerCase().includes(materialSearch.toLowerCase()) ||
          m.vendor?.name?.toLowerCase().includes(materialSearch.toLowerCase())
        );
        return (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Materials / Stock</h3>
            {canManage && (
              <button
                onClick={() => { setShowMaterialForm(!showMaterialForm); setEditingMaterialId(null); }}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg"
              >+ Add Material</button>
            )}
          </div>
          {(project.materials || []).length > 0 && (
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={materialSearch} onChange={(e) => setMaterialSearch(e.target.value)} placeholder="Search materials by name, category, vendor..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          )}
          {showMaterialForm && (
            <form onSubmit={createMaterial} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">New Material</h4>
              <div className="grid grid-cols-2 gap-3">
                <input required value={materialForm.itemName || ""} onChange={(e) => setMaterialForm({...materialForm, itemName: e.target.value})} placeholder="Item name *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <select value={materialForm.category || "general"} onChange={(e) => setMaterialForm({...materialForm, category: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="masonry">Masonry</option><option value="steel">Steel</option><option value="binding">Cement/Binding</option>
                  <option value="aggregate">Aggregate</option><option value="tiles">Tiles</option><option value="electrical">Electrical</option>
                  <option value="plumbing">Plumbing</option><option value="paint">Paint</option><option value="general">General</option>
                </select>
                <input required type="number" min="0" step="0.01" value={materialForm.quantity || ""} onChange={(e) => setMaterialForm({...materialForm, quantity: e.target.value})} placeholder="Quantity *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input required value={materialForm.unit || ""} onChange={(e) => setMaterialForm({...materialForm, unit: e.target.value})} placeholder="Unit (bags, kg, pcs)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input required type="number" min="0.01" step="0.01" value={materialForm.unitPrice || ""} onChange={(e) => setMaterialForm({...materialForm, unitPrice: e.target.value})} placeholder="Unit price (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="number" min="0" step="1" value={materialForm.minStockLevel || ""} onChange={(e) => setMaterialForm({...materialForm, minStockLevel: e.target.value})} placeholder="Min stock level" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <select value={materialForm.vendorId || ""} onChange={(e) => setMaterialForm({...materialForm, vendorId: e.target.value})} className="border border-gray-200 rounded-lg px-3 py-2 text-sm col-span-2">
                  <option value="">Select vendor (optional)</option>
                  {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Add Material</button>
                <button type="button" onClick={() => { setShowMaterialForm(false); setMaterialForm({}); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          )}
          {(project.materials || []).length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<Boxes className="w-10 h-10" />} title="No materials added yet" hint="Add materials to track inventory, costs, and stock levels for this project." />
            </div>
          ) : filteredMaterials.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<Search className="w-10 h-10" />} title="No materials match your search" hint="Try a different name, category, or vendor." />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50">
                    {["Item", "Category", "Qty", "Unit", "Unit Price", "Stock", "Min Stock", "Vendor", "Status", ""].map((h, i) => (
                      <th key={i} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>
                    ))}
                  </tr></thead>
                  <tbody>
                    {filteredMaterials.map((m: any) => (
                      editingMaterialId === m.id ? (
                        <tr key={m.id + "-edit"} className="border-b border-blue-100 bg-blue-50">
                          <td colSpan={10} className="py-3 px-3">
                            <form onSubmit={(e) => updateMaterial(e, m.id)} className="grid grid-cols-4 gap-2">
                              <input required value={editMaterialForm.itemName || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, itemName: e.target.value})} placeholder="Item name *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <select value={editMaterialForm.category || "general"} onChange={(e) => setEditMaterialForm({...editMaterialForm, category: e.target.value})} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                                <option value="masonry">Masonry</option><option value="steel">Steel</option><option value="binding">Cement/Binding</option>
                                <option value="aggregate">Aggregate</option><option value="tiles">Tiles</option><option value="electrical">Electrical</option>
                                <option value="plumbing">Plumbing</option><option value="paint">Paint</option><option value="general">General</option>
                              </select>
                              <input required type="number" min="0" step="0.01" value={editMaterialForm.quantity || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, quantity: e.target.value})} placeholder="Qty *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <input required value={editMaterialForm.unit || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, unit: e.target.value})} placeholder="Unit" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <input required type="number" min="0.01" step="0.01" value={editMaterialForm.unitPrice || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, unitPrice: e.target.value})} placeholder="Unit price *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <input type="number" min="0" step="0.01" value={editMaterialForm.stockQuantity ?? ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, stockQuantity: e.target.value})} placeholder="Stock qty" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <input type="number" min="0" step="1" value={editMaterialForm.minStockLevel ?? ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, minStockLevel: e.target.value})} placeholder="Min stock" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <select value={editMaterialForm.vendorId || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, vendorId: e.target.value})} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                                <option value="">No vendor</option>
                                {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                              </select>
                              <div className="col-span-4 flex gap-2 mt-1">
                                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">Save</button>
                                <button type="button" onClick={() => { setEditingMaterialId(null); setEditMaterialForm({}); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">Cancel</button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 font-medium text-gray-900 whitespace-nowrap">{m.itemName}</td>
                          <td className="py-3 px-3 text-gray-500 capitalize">{m.category}</td>
                          <td className="py-3 px-3 font-medium">{m.quantity}</td>
                          <td className="py-3 px-3 text-gray-500">{m.unit}</td>
                          <td className="py-3 px-3 whitespace-nowrap">PKR {m.unitPrice?.toLocaleString()}</td>
                          <td className="py-3 px-3 font-medium">{m.stockQuantity}</td>
                          <td className="py-3 px-3 text-gray-500">{m.minStockLevel}</td>
                          <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{m.vendor?.name || "—"}</td>
                          <td className="py-3 px-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${m.stockQuantity <= m.minStockLevel ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                              {m.stockQuantity <= m.minStockLevel ? "Low Stock" : "OK"}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            {canManage && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditingMaterialId(m.id); setEditMaterialForm({ itemName: m.itemName, category: m.category, quantity: m.quantity, unit: m.unit, unitPrice: m.unitPrice, stockQuantity: m.stockQuantity, minStockLevel: m.minStockLevel, vendorId: m.vendorId || "" }); setShowMaterialForm(false); }}
                                  className="p-1 text-blue-500 hover:bg-blue-50 rounded"
                                  title="Edit"
                                ><Pencil className="w-3.5 h-3.5" /></button>
                                {deletingMaterialId === m.id ? (
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => deleteMaterial(m.id)} className="text-xs px-2 py-0.5 bg-red-600 text-white rounded font-medium">Confirm</button>
                                    <button onClick={() => setDeletingMaterialId(null)} className="text-xs px-1.5 py-0.5 border border-gray-300 rounded"><X className="w-3 h-3" /></button>
                                  </div>
                                ) : (
                                  <button onClick={() => setDeletingMaterialId(m.id)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Delete"><Trash2 className="w-3.5 h-3.5" /></button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredMaterials.map((m: any) => (
                  <div key={m.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    {editingMaterialId === m.id ? (
                      <form onSubmit={(e) => updateMaterial(e, m.id)} className="space-y-2">
                        <p className="text-xs font-semibold text-blue-700 mb-2">Editing: {m.itemName}</p>
                        <div className="grid grid-cols-2 gap-2">
                          <input required value={editMaterialForm.itemName || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, itemName: e.target.value})} placeholder="Item name *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs col-span-2" />
                          <select value={editMaterialForm.category || "general"} onChange={(e) => setEditMaterialForm({...editMaterialForm, category: e.target.value})} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs">
                            <option value="masonry">Masonry</option><option value="steel">Steel</option><option value="binding">Cement/Binding</option>
                            <option value="aggregate">Aggregate</option><option value="tiles">Tiles</option><option value="electrical">Electrical</option>
                            <option value="plumbing">Plumbing</option><option value="paint">Paint</option><option value="general">General</option>
                          </select>
                          <input required value={editMaterialForm.unit || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, unit: e.target.value})} placeholder="Unit" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <input required type="number" min="0" step="0.01" value={editMaterialForm.quantity || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, quantity: e.target.value})} placeholder="Qty *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <input required type="number" min="0.01" step="0.01" value={editMaterialForm.unitPrice || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, unitPrice: e.target.value})} placeholder="Unit price *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <input type="number" min="0" step="0.01" value={editMaterialForm.stockQuantity ?? ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, stockQuantity: e.target.value})} placeholder="Stock qty" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <input type="number" min="0" step="1" value={editMaterialForm.minStockLevel ?? ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, minStockLevel: e.target.value})} placeholder="Min stock" className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs" />
                          <select value={editMaterialForm.vendorId || ""} onChange={(e) => setEditMaterialForm({...editMaterialForm, vendorId: e.target.value})} className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs col-span-2">
                            <option value="">No vendor</option>
                            {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button type="submit" className="flex-1 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">Save Changes</button>
                          <button type="button" onClick={() => { setEditingMaterialId(null); setEditMaterialForm({}); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">Cancel</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div>
                            <p className="font-semibold text-gray-900">{m.itemName}</p>
                            <p className="text-xs text-gray-500 capitalize">{m.category}{m.vendor?.name ? ` · ${m.vendor.name}` : ""}</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${m.stockQuantity <= m.minStockLevel ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                            {m.stockQuantity <= m.minStockLevel ? "Low Stock" : "OK"}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          <div><span className="text-gray-400">Qty: </span><span className="text-gray-700 font-medium">{m.quantity} {m.unit}</span></div>
                          <div><span className="text-gray-400">Unit Price: </span><span className="text-gray-700">PKR {m.unitPrice?.toLocaleString()}</span></div>
                          <div><span className="text-gray-400">Stock: </span><span className="text-gray-700 font-medium">{m.stockQuantity}</span></div>
                          <div><span className="text-gray-400">Min Stock: </span><span className="text-gray-700">{m.minStockLevel}</span></div>
                        </div>
                        {canManage && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                            <button
                              onClick={() => { setEditingMaterialId(m.id); setEditMaterialForm({ itemName: m.itemName, category: m.category, quantity: m.quantity, unit: m.unit, unitPrice: m.unitPrice, stockQuantity: m.stockQuantity, minStockLevel: m.minStockLevel, vendorId: m.vendorId || "" }); setShowMaterialForm(false); }}
                              className="flex-1 py-1.5 text-xs border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50"
                            ><span className="flex items-center justify-center gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</span></button>
                            {deletingMaterialId === m.id ? (
                              <div className="flex gap-1 flex-1">
                                <button onClick={() => deleteMaterial(m.id)} className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium">Confirm Delete</button>
                                <button onClick={() => setDeletingMaterialId(null)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <button onClick={() => setDeletingMaterialId(m.id)} className="flex-1 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50"><span className="flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Remove</span></button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
        );
      })()}

      {tab === "Finance" && (() => {
        const filteredLedgerEntries = (project.ledgerEntries || []).filter((e: any) =>
          !ledgerSearch ||
          e.description?.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
          e.category?.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
          e.bankAccount?.name?.toLowerCase().includes(ledgerSearch.toLowerCase()) ||
          e.type?.toLowerCase().includes(ledgerSearch.toLowerCase())
        );
        return (
        <div className="space-y-4">
          {/* Partner Investments — capital funding this project, kept
              separate from the earned-income ledger below (see /api/investments
              for why: investments must not count as P&L revenue). */}
          {canManageFinanceForInvestments && (() => {
            const investList: any[] = investments || [];
            const totalInvested = investList.reduce((s, v) => s + (v.amount || 0), 0);
            return (
              <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2"><HandCoins className="w-4 h-4 text-purple-500" /> Partner Investments</h3>
                    {totalInvested > 0 && <p className="text-xs text-gray-400 mt-0.5">PKR {totalInvested.toLocaleString()} invested in this project</p>}
                  </div>
                  <button onClick={() => { setShowInvestmentForm(!showInvestmentForm); setInvestmentError(""); }} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">
                    {showInvestmentForm ? "Cancel" : "+ Record Investment"}
                  </button>
                </div>

                {showInvestmentForm && (
                  <form onSubmit={createInvestment} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    {investmentError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">{investmentError}</div>}
                    <select required value={investmentForm.partnerId || ""} onChange={(e) => setInvestmentForm({ ...investmentForm, partnerId: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Select Partner *</option>
                      {(Array.isArray(partnersList) ? partnersList : []).filter((p: any) => p.isActive !== false).map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <input required type="number" min="0.01" step="0.01" value={investmentForm.amount || ""} onChange={(e) => setInvestmentForm({ ...investmentForm, amount: e.target.value })} placeholder="Amount (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      <input type="date" value={investmentForm.date || ""} onChange={(e) => setInvestmentForm({ ...investmentForm, date: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <select value={investmentForm.bankAccountId || ""} onChange={(e) => setInvestmentForm({ ...investmentForm, bankAccountId: e.target.value || undefined })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option value="">Bank Account (optional — credits the balance)</option>
                      {(Array.isArray(bankAccounts) ? bankAccounts : []).map((b: any) => <option key={b.id} value={b.id}>{b.name} — PKR {(b.balance || 0).toLocaleString()}</option>)}
                    </select>
                    <textarea value={investmentForm.notes || ""} onChange={(e) => setInvestmentForm({ ...investmentForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                    <div className="flex gap-2">
                      <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Record Investment</button>
                      <button type="button" onClick={() => { setShowInvestmentForm(false); setInvestmentForm({}); setInvestmentError(""); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
                    </div>
                  </form>
                )}

                {investList.length === 0 ? (
                  <p className="text-sm text-gray-400">No partner investments recorded for this project yet.</p>
                ) : (
                  <div className="space-y-2">
                    {investList.map((v: any) => (
                      <div key={v.id} className="flex items-center justify-between border border-gray-100 rounded-lg p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{v.partner?.name || "Unknown partner"}</p>
                          <p className="text-xs text-gray-400">{new Date(v.date).toLocaleDateString()}{v.bankAccount?.name ? ` · ${v.bankAccount.name}` : ""}{v.notes ? ` · ${v.notes}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-semibold text-green-600">PKR {(v.amount || 0).toLocaleString()}</span>
                          {["admin", "ceo"].includes(role) && (
                            <button onClick={() => deleteInvestment(v.id)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg" title="Reverse"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-gray-900">Ledger Entries</h3>
            {canManageFinance && (
              <button
                onClick={() => { setShowLedgerForm(!showLedgerForm); setEditingLedgerId(null); setLedgerError(""); }}
                className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg"
              >+ Add Entry</button>
            )}
          </div>

          {ledgerError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{ledgerError}</div>}

          {(project.ledgerEntries || []).length > 0 && (
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={ledgerSearch} onChange={(e) => setLedgerSearch(e.target.value)} placeholder="Search entries by description, category, account..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>
          )}

          {showLedgerForm && canManageFinance && (
            <form onSubmit={createLedgerEntry} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">New Ledger Entry</h4>
              <div className="grid grid-cols-2 gap-3">
                <select value={ledgerForm.type || "expense"} onChange={(e) => setLedgerForm({ ...ledgerForm, type: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </select>
                <input required type="number" min="0.01" step="0.01" value={ledgerForm.amount || ""} onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })} placeholder="Amount (PKR) *" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input required value={ledgerForm.description || ""} onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })} placeholder="Description *" className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <select required value={ledgerForm.category || ""} onChange={(e) => setLedgerForm({ ...ledgerForm, category: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Select Category *</option>
                  {LEDGER_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                </select>
                <input required type="date" value={ledgerForm.date || ""} onChange={(e) => setLedgerForm({ ...ledgerForm, date: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <select value={ledgerForm.bankAccountId || ""} onChange={(e) => setLedgerForm({ ...ledgerForm, bankAccountId: e.target.value || undefined })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Bank Account (optional)</option>
                  {(Array.isArray(bankAccounts) ? bankAccounts : []).map((b: any) => <option key={b.id} value={b.id}>{b.name} — PKR {(b.balance || 0).toLocaleString()}</option>)}
                </select>
                <select value={ledgerForm.vendorId || ""} onChange={(e) => setLedgerForm({ ...ledgerForm, vendorId: e.target.value || undefined })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="">Vendor (optional)</option>
                  {(vendors || []).map((v: any) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <input value={ledgerForm.partyName || ""} onChange={(e) => setLedgerForm({ ...ledgerForm, partyName: e.target.value })} placeholder="Other party name (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input value={ledgerForm.referenceNumber || ""} onChange={(e) => setLedgerForm({ ...ledgerForm, referenceNumber: e.target.value })} placeholder="Reference / voucher # (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Add Entry</button>
                <button type="button" onClick={() => { setShowLedgerForm(false); setLedgerForm({ type: "expense", category: "" }); setLedgerError(""); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
              </div>
            </form>
          )}

          {(project.ledgerEntries || []).length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<Wallet className="w-10 h-10" />} title="No finance entries yet" hint="Add income and expense entries for this project here." />
            </div>
          ) : filteredLedgerEntries.length === 0 ? (
            <div className="bg-white border border-gray-200 rounded-xl">
              <EmptyState icon={<Search className="w-10 h-10" />} title="No entries match your search" hint="Try a different description, category, or account." />
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-gray-200 bg-gray-50">
                    {["Date", "Type", "Category", "Amount", "Description", "Account", ""].map(h => <th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {filteredLedgerEntries.map((e: any) => (
                      editingLedgerId === e.id ? (
                        <tr key={e.id + "-edit"} className="border-b border-blue-100 bg-blue-50">
                          <td colSpan={7} className="py-3 px-3">
                            <form onSubmit={(ev) => updateLedgerEntry(ev, e.id)} className="grid grid-cols-4 gap-2">
                              <input required type="date" value={editLedgerForm.date || ""} onChange={(ev) => setEditLedgerForm({ ...editLedgerForm, date: ev.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <select value={editLedgerForm.type || "expense"} onChange={(ev) => setEditLedgerForm({ ...editLedgerForm, type: ev.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                                <option value="income">Income</option>
                                <option value="expense">Expense</option>
                              </select>
                              <input required type="number" min="0.01" step="0.01" value={editLedgerForm.amount || ""} onChange={(ev) => setEditLedgerForm({ ...editLedgerForm, amount: ev.target.value })} placeholder="Amount *" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <select required value={editLedgerForm.category || ""} onChange={(ev) => setEditLedgerForm({ ...editLedgerForm, category: ev.target.value })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                                {LEDGER_CATEGORIES.map(c => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
                              </select>
                              <input required value={editLedgerForm.description || ""} onChange={(ev) => setEditLedgerForm({ ...editLedgerForm, description: ev.target.value })} placeholder="Description *" className="col-span-2 border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <select value={editLedgerForm.bankAccountId || ""} onChange={(ev) => setEditLedgerForm({ ...editLedgerForm, bankAccountId: ev.target.value || undefined })} className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm">
                                <option value="">No bank account</option>
                                {(Array.isArray(bankAccounts) ? bankAccounts : []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                              <input value={editLedgerForm.referenceNumber || ""} onChange={(ev) => setEditLedgerForm({ ...editLedgerForm, referenceNumber: ev.target.value })} placeholder="Reference #" className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm" />
                              <div className="col-span-4 flex gap-2 mt-1">
                                <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">Save</button>
                                <button type="button" onClick={() => { setEditingLedgerId(null); setEditLedgerForm({}); }} className="px-3 py-1.5 border border-gray-300 rounded-lg text-xs">Cancel</button>
                              </div>
                            </form>
                          </td>
                        </tr>
                      ) : (
                        <tr key={e.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{new Date(e.date).toLocaleDateString()}</td>
                          <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${e.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.type}</span></td>
                          <td className="py-3 px-3 text-gray-500 capitalize">{e.category}</td>
                          <td className={`py-3 px-3 font-semibold whitespace-nowrap ${e.type === "income" ? "text-green-600" : "text-red-600"}`}>PKR {e.amount?.toLocaleString()}</td>
                          <td className="py-3 px-3 text-gray-600 max-w-xs truncate">{e.description}</td>
                          <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{e.bankAccount?.name || "—"}</td>
                          <td className="py-3 px-3">
                            {canManageFinance && (
                              <div className="flex items-center gap-1">
                                <button onClick={() => startEditLedger(e)} className="p-1 text-blue-500 hover:bg-blue-50 rounded" title="Edit"><Pencil className="w-3.5 h-3.5" /></button>
                                {canReverseFinance && (
                                  deletingLedgerId === e.id ? (
                                    <div className="flex items-center gap-1">
                                      <button onClick={() => deleteLedgerEntry(e.id)} className="text-xs px-2 py-0.5 bg-red-600 text-white rounded font-medium">Confirm</button>
                                      <button onClick={() => setDeletingLedgerId(null)} className="text-xs px-1.5 py-0.5 border border-gray-300 rounded"><X className="w-3 h-3" /></button>
                                    </div>
                                  ) : (
                                    <button onClick={() => setDeletingLedgerId(e.id)} className="p-1 text-red-400 hover:bg-red-50 rounded" title="Reverse entry"><Trash2 className="w-3.5 h-3.5" /></button>
                                  )
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filteredLedgerEntries.map((e: any) => (
                  <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <p className={`font-semibold ${e.type === "income" ? "text-green-700" : "text-red-700"}`}>PKR {e.amount?.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 capitalize">{e.category}{e.bankAccount?.name ? ` · ${e.bankAccount.name}` : ""}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${e.type === "income" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{e.type}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-gray-400">{new Date(e.date).toLocaleDateString()}</span>
                      {e.description && <><span className="text-gray-300">·</span><span className="text-gray-600 truncate">{e.description}</span></>}
                    </div>
                    {canManageFinance && (
                      <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                        <button onClick={() => startEditLedger(e)} className="flex-1 py-1.5 text-xs border border-blue-200 text-blue-700 rounded-lg hover:bg-blue-50">
                          <span className="flex items-center justify-center gap-1"><Pencil className="w-3.5 h-3.5" /> Edit</span>
                        </button>
                        {canReverseFinance && (
                          deletingLedgerId === e.id ? (
                            <div className="flex gap-1 flex-1">
                              <button onClick={() => deleteLedgerEntry(e.id)} className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded-lg font-medium">Confirm</button>
                              <button onClick={() => setDeletingLedgerId(null)} className="px-3 py-1.5 text-xs border border-gray-300 rounded-lg"><X className="w-3 h-3" /></button>
                            </div>
                          ) : (
                            <button onClick={() => setDeletingLedgerId(e.id)} className="flex-1 py-1.5 text-xs border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                              <span className="flex items-center justify-center gap-1"><Trash2 className="w-3.5 h-3.5" /> Reverse</span>
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-xs text-green-700 mb-1">Total Income</p>
              <p className="text-lg font-bold text-green-800">PKR {income.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-xs text-red-700 mb-1">Total Expense</p>
              <p className="text-lg font-bold text-red-800">PKR {expense.toLocaleString()}</p>
            </div>
            <div className={`${income - expense >= 0 ? "bg-blue-50 border-blue-200" : "bg-red-50 border-red-200"} border rounded-xl p-4 text-center`}>
              <p className="text-xs text-blue-700 mb-1">Net Profit</p>
              <p className={`text-lg font-bold ${income - expense >= 0 ? "text-blue-800" : "text-red-800"}`}>PKR {(income - expense).toLocaleString()}</p>
            </div>
          </div>
        </div>
        );
      })()}

      {tab === "Billing" && (() => {
        const invoiceSubtotal = invoiceItems.reduce((s, it) => s + (it.quantity || 0) * (it.unitPrice || 0), 0);
        const invoiceTax = invoiceSubtotal * (parseFloat(String(invoiceForm.taxPercent || 0)) / 100);
        const invoiceGrandTotal = invoiceSubtotal + invoiceTax;
        const projectInvoices: any[] = project.invoices || [];
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Invoices</h3>
              {canManageFinance && (
                <button onClick={() => { setShowInvoiceForm(!showInvoiceForm); setInvoiceError(""); }} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">
                  {showInvoiceForm ? "Cancel" : "+ New Invoice"}
                </button>
              )}
            </div>

            {invoiceError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{invoiceError}</div>}
            {!project.clientId && (
              <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-lg text-sm">This project has no client set — set one on the Overview tab before creating invoices.</div>
            )}

            {showInvoiceForm && canManageFinance && (
              <form onSubmit={createInvoice} className="bg-white border border-gray-200 rounded-xl p-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <select value={invoiceForm.status || "draft"} onChange={(e) => setInvoiceForm({ ...invoiceForm, status: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {["draft", "sent", "cancelled"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Issue Date</label><input type="date" value={invoiceForm.issueDate || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, issueDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Due Date</label><input type="date" value={invoiceForm.dueDate || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, dueDate: e.target.value })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="flex flex-col gap-1"><label className="text-xs text-gray-500">Tax %</label><input type="number" step="0.1" min="0" max="100" value={invoiceForm.taxPercent || 0} onChange={(e) => setInvoiceForm({ ...invoiceForm, taxPercent: parseFloat(e.target.value || "0") })} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                  <div className="sm:col-span-2"><textarea value={invoiceForm.notes || ""} onChange={(e) => setInvoiceForm({ ...invoiceForm, notes: e.target.value })} placeholder="Notes (optional)" rows={1} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" /></div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-gray-700">Line Items</h4>
                    <button type="button" onClick={addInvoiceItem} className="text-xs text-blue-600 hover:underline">+ Add Item</button>
                  </div>
                  {invoiceItems.map((it, idx) => (
                    <div key={idx} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
                      <input value={it.description} onChange={(e) => updateInvoiceItem(idx, "description", e.target.value)} placeholder="Description *" className="col-span-2 sm:col-span-5 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      <input type="number" value={it.quantity} min="0" onChange={(e) => updateInvoiceItem(idx, "quantity", parseFloat(e.target.value) || 0)} placeholder="Qty" className="col-span-1 sm:col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      <input type="number" step="0.01" value={it.unitPrice} min="0" onChange={(e) => updateInvoiceItem(idx, "unitPrice", parseFloat(e.target.value) || 0)} placeholder="Unit Price" className="col-span-1 sm:col-span-3 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                      <span className="col-span-1 sm:col-span-1 text-sm font-medium text-gray-700 text-right whitespace-nowrap">PKR {(it.quantity * it.unitPrice).toLocaleString()}</span>
                      {invoiceItems.length > 1 && <button type="button" onClick={() => removeInvoiceItem(idx)} className="col-span-1 sm:col-span-1 text-red-400 hover:text-red-600 text-center">✕</button>}
                    </div>
                  ))}
                  <div className="border-t border-gray-200 pt-3 flex flex-col sm:flex-row sm:justify-end gap-2 sm:gap-6 text-sm">
                    <span className="text-gray-500">Subtotal: <strong>PKR {invoiceSubtotal.toLocaleString()}</strong></span>
                    <span className="text-gray-500">Tax ({invoiceForm.taxPercent || 0}%): <strong>PKR {invoiceTax.toLocaleString()}</strong></span>
                    <span className="text-gray-900 font-bold">Grand Total: PKR {invoiceGrandTotal.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm">Create Invoice</button>
                  <button type="button" onClick={() => { setShowInvoiceForm(false); setInvoiceError(""); }} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
                </div>
              </form>
            )}

            {projectInvoices.length === 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl">
                <EmptyState icon={<Wallet className="w-10 h-10" />} title="No invoices yet" hint="Invoices billed to this project's client will appear here." />
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto bg-white border border-gray-200 rounded-xl">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-gray-200 bg-gray-50">
                      {["Invoice #", "Issue Date", "Due Date", "Amount", "Status", "Actions"].map((h) => <th key={h} className="text-left py-3 px-3 text-xs text-gray-500 font-medium whitespace-nowrap">{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {projectInvoices.map((inv: any) => (
                        <tr key={inv.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-3 font-mono text-xs text-gray-700">{inv.invoiceNumber}</td>
                          <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : "—"}</td>
                          <td className={`py-3 px-3 whitespace-nowrap ${inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== "paid" ? "text-red-500 font-medium" : "text-gray-500"}`}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
                          <td className="py-3 px-3 font-bold text-gray-900 whitespace-nowrap">PKR {(inv.grandTotal || 0).toLocaleString()}</td>
                          <td className="py-3 px-3"><span className={`text-xs px-2 py-0.5 rounded-full capitalize ${INVOICE_STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-600"}`}>{inv.status}</span></td>
                          <td className="py-3 px-3">
                            <div className="flex gap-2 flex-wrap">
                              <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">PDF</a>
                              {canManageFinance && inv.status === "draft" && <button onClick={() => markInvoiceSent(inv.id)} className="text-xs text-blue-600 hover:underline">Mark Sent</button>}
                              {canManageFinance && ["sent", "overdue"].includes(inv.status) && <button onClick={() => { setPaidInvoiceModal(inv); setPaidInvoiceBankId(""); }} className="text-xs text-green-600 hover:underline font-medium">Mark Paid</button>}
                              {canManageFinance && ["draft", "sent"].includes(inv.status) && <button onClick={() => cancelInvoice(inv.id)} className="text-xs text-red-500 hover:underline">Cancel</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="md:hidden space-y-3">
                  {projectInvoices.map((inv: any) => (
                    <div key={inv.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-xs text-gray-700">{inv.invoiceNumber}</p>
                          <p className="font-bold text-gray-900">PKR {(inv.grandTotal || 0).toLocaleString()}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full capitalize shrink-0 ${INVOICE_STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-600"}`}>{inv.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3 text-xs">
                        <div><span className="text-gray-400">Issued: </span><span className="text-gray-700 whitespace-nowrap">{inv.issueDate ? new Date(inv.issueDate).toLocaleDateString() : "—"}</span></div>
                        <div><span className="text-gray-400">Due: </span><span className={`whitespace-nowrap ${inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== "paid" ? "text-red-500 font-medium" : "text-gray-700"}`}>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</span></div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex gap-3 flex-wrap">
                        <a href={`/api/invoices/${inv.id}/pdf`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline">PDF</a>
                        {canManageFinance && inv.status === "draft" && <button onClick={() => markInvoiceSent(inv.id)} className="text-xs text-blue-600 hover:underline">Mark Sent</button>}
                        {canManageFinance && ["sent", "overdue"].includes(inv.status) && <button onClick={() => { setPaidInvoiceModal(inv); setPaidInvoiceBankId(""); }} className="text-xs text-green-600 hover:underline font-medium">Mark Paid</button>}
                        {canManageFinance && ["draft", "sent"].includes(inv.status) && <button onClick={() => cancelInvoice(inv.id)} className="text-xs text-red-500 hover:underline">Cancel</button>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {paidInvoiceModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
                  <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
                    <div>
                      <h2 className="font-semibold text-gray-900">Mark Invoice Paid</h2>
                      <p className="text-xs text-gray-500 mt-0.5">{paidInvoiceModal.invoiceNumber} · PKR {(paidInvoiceModal.grandTotal || 0).toLocaleString()}</p>
                    </div>
                    <button onClick={() => setPaidInvoiceModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
                  </div>
                  <div className="p-6 space-y-4">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Received Into Bank Account</label>
                      <select value={paidInvoiceBankId} onChange={(e) => setPaidInvoiceBankId(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                        <option value="">Not specified</option>
                        {(Array.isArray(bankAccounts) ? bankAccounts : []).map((b: any) => <option key={b.id} value={b.id}>{b.name} — PKR {(b.balance || 0).toLocaleString()}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={confirmInvoicePaid} className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">Confirm Payment</button>
                      <button onClick={() => setPaidInvoiceModal(null)} className="px-4 py-2 border border-gray-200 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">Cancel</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {tab === "Team" && (() => {
        const activeTeam = (project.employees || []).filter((pe: any) => !pe.endDate);
        const assignedIds = new Set(activeTeam.map((pe: any) => pe.employee?.id || pe.employeeId));
        const empData: any[] = employeesList?.data ? employeesList.data : (Array.isArray(employeesList) ? employeesList : []);
        const assignableEmployees = empData
          .filter((e: any) => e.isActive !== false && !assignedIds.has(e.id));
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold text-gray-900">Assigned Team</h3>
              {canManage && (
                <button onClick={() => { setShowTeamForm(!showTeamForm); setTeamForm({}); }} className="text-sm px-3 py-1.5 bg-blue-600 text-white rounded-lg">+ Assign Employee</button>
              )}
            </div>
            {showTeamForm && canManage && (
              <form onSubmit={assignEmployee} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <select required value={teamForm.employeeId || ""} onChange={(e) => setTeamForm({ ...teamForm, employeeId: e.target.value })} className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="">Select employee *</option>
                    {assignableEmployees.map((emp: any) => <option key={emp.id} value={emp.id}>{emp.name} — {emp.role}</option>)}
                  </select>
                  <input value={teamForm.role || ""} onChange={(e) => setTeamForm({ ...teamForm, role: e.target.value })} placeholder="Role on this project (optional)" className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={teamLoading} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">{teamLoading ? "Assigning…" : "Assign"}</button>
                  <button type="button" onClick={() => setShowTeamForm(false)} className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">Cancel</button>
                </div>
              </form>
            )}
            {activeTeam.map((pe: any) => (
              <div key={pe.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-medium">{pe.employee?.name?.[0]}</div>
                <div>
                  <p className="font-medium text-sm text-gray-900">{pe.employee?.name}</p>
                  <p className="text-xs text-gray-500">{pe.role}</p>
                </div>
                <div className="ml-auto flex items-center gap-3">
                  <p className="text-xs text-gray-400">Since {pe.startDate ? new Date(pe.startDate).toLocaleDateString() : "—"}</p>
                  {canManage && (
                    <button onClick={() => removeTeamMember(pe.employee?.id || pe.employeeId)} className="text-xs text-red-500 hover:underline">Remove</button>
                  )}
                </div>
              </div>
            ))}
            {activeTeam.length === 0 && (
              <div className="bg-white border border-gray-200 rounded-xl">
                <EmptyState icon={<Users className="w-10 h-10" />} title="No team members assigned" hint="Assign employees to this project to track who's working on what." />
              </div>
            )}
          </div>
        );
      })()}

      {tab === "Documents" && (() => {
        const docs: any[] = project.documents || [];
        const byCategory: Record<string, any[]> = {};
        for (const d of docs) { (byCategory[d.category || "general"] ||= []).push(d); }
        const uploadedCount = TENDER_DOC_CHECKLIST.filter((c) => (byCategory[c] || []).length > 0).length;
        const generalDocs = (byCategory["general"] || []).filter((doc: any) =>
          !documentSearch || doc.name?.toLowerCase().includes(documentSearch.toLowerCase())
        );
        const visibleChecklist = TENDER_DOC_CHECKLIST.filter((category) => {
          if (!documentSearch) return true;
          const q = documentSearch.toLowerCase();
          if (DOCUMENT_CATEGORY_LABELS[category]?.toLowerCase().includes(q)) return true;
          return (byCategory[category] || []).some((doc: any) => doc.name?.toLowerCase().includes(q));
        });

        const UploadInline = ({ category }: { category: string }) => (
          docUploadCategory === category ? (
            <form onSubmit={uploadProjectDocument} className="mt-2 flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 border border-gray-200 rounded-lg p-2">
              <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700" />
              <input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Label (optional)" className="border border-gray-200 rounded px-2 py-1 text-xs flex-1 min-w-0" />
              <div className="flex gap-1.5">
                <button type="submit" disabled={docUploading} className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium disabled:opacity-50">{docUploading ? "Uploading…" : "Save"}</button>
                <button type="button" onClick={() => { setDocUploadCategory(null); setDocFile(null); setDocName(""); }} className="px-2.5 py-1 border border-gray-200 text-gray-600 rounded text-xs">Cancel</button>
              </div>
            </form>
          ) : (
            canManage && <button onClick={() => { setDocUploadCategory(category); setDocFile(null); setDocName(""); }} className="mt-2 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"><Upload className="w-3 h-3" /> Upload</button>
          )
        );

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900">Tender & Contract Documents</h3>
              <span className="text-xs text-gray-500">{uploadedCount}/{TENDER_DOC_CHECKLIST.length} provided</span>
            </div>

            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input value={documentSearch} onChange={(e) => setDocumentSearch(e.target.value)} placeholder="Search documents by name or category..."
                className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
              {visibleChecklist.length === 0 && (
                <div className="p-4"><p className="text-sm text-gray-400 text-center">No documents match your search.</p></div>
              )}
              {visibleChecklist.map((category) => {
                const items = byCategory[category] || [];
                const has = items.length > 0;
                return (
                  <div key={category} className="p-4">
                    <div className="flex items-start gap-3">
                      {has ? <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" /> : <Circle className="w-5 h-5 text-gray-300 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{DOCUMENT_CATEGORY_LABELS[category]}</p>
                        {items.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-2 mt-1.5">
                            <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                            <span className="text-xs text-gray-700 truncate flex-1">{doc.name}</span>
                            {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">Download</a>}
                            {canManage && <button onClick={() => deleteProjectDocument(doc.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Delete</button>}
                          </div>
                        ))}
                        {!has && <p className="text-xs text-gray-400 mt-0.5">Not provided</p>}
                        <UploadInline category={category} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Other / general project documents */}
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">Other Documents</h3>
                {canManage && docUploadCategory !== "general" && (
                  <button onClick={() => { setDocUploadCategory("general"); setDocFile(null); setDocName(""); }} className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"><Upload className="w-3 h-3" /> Upload</button>
                )}
              </div>
              {docUploadCategory === "general" && (
                <form onSubmit={uploadProjectDocument} className="mb-3 flex flex-col sm:flex-row gap-2 items-start sm:items-center bg-gray-50 border border-gray-200 rounded-lg p-2">
                  <input type="file" onChange={(e) => setDocFile(e.target.files?.[0] || null)} className="text-xs text-gray-500 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700" />
                  <input value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Document name" className="border border-gray-200 rounded px-2 py-1 text-xs flex-1 min-w-0" />
                  <div className="flex gap-1.5">
                    <button type="submit" disabled={docUploading} className="px-2.5 py-1 bg-blue-600 text-white rounded text-xs font-medium disabled:opacity-50">{docUploading ? "Uploading…" : "Save"}</button>
                    <button type="button" onClick={() => { setDocUploadCategory(null); setDocFile(null); setDocName(""); }} className="px-2.5 py-1 border border-gray-200 text-gray-600 rounded text-xs">Cancel</button>
                  </div>
                </form>
              )}
              {generalDocs.length === 0 ? (
                <p className="text-xs text-gray-400">No other documents uploaded.</p>
              ) : (
                <div className="space-y-2">
                  {generalDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <span className="text-xs text-gray-700 truncate flex-1">{doc.name}</span>
                      {doc.fileUrl && <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline shrink-0">Download</a>}
                      {canManage && <button onClick={() => deleteProjectDocument(doc.id)} className="text-xs text-red-400 hover:text-red-600 shrink-0">Delete</button>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {tab === "Report" && (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Project Report (PDF)</h3>
          <p className="text-gray-500 text-sm mb-6">Download a complete multi-page PDF report including project summary, materials, financials, tasks & milestones.</p>
          <button onClick={downloadReport} className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
            <span className="flex items-center gap-1.5"><Download className="w-4 h-4" /> Download PDF Report</span>
          </button>
        </div>
      )}
    </div>
  );
}
