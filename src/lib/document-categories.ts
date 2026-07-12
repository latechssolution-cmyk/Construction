// Tender / contract document taxonomy from the client guideline. Kept in a
// client-safe module (no mongoose import) so both the Document model and client
// components (documents page, project tender-docs checklist) can share it.

export const DOCUMENT_CATEGORIES = [
  "tender_notice",
  "tender_documents",
  "prebid_meeting",
  "submitted_bid",
  "bid_comparative",
  "work_order",
  "signed_boq",
  "contract_agreement",
  "guarantee_bid",
  "guarantee_mobilization",
  "guarantee_performance",
  "general",
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<string, string> = {
  tender_notice: "Tender Notice / Invitation",
  tender_documents: "Tender Documents (Engineer Estimate & Blank BOQ)",
  prebid_meeting: "Pre-Bid Meeting Documents",
  submitted_bid: "Submitted Bid (BOQ & Tech Proposal)",
  bid_comparative: "Bid Comparative",
  work_order: "Work Order",
  signed_boq: "Signed BOQ",
  contract_agreement: "Contract Agreement",
  guarantee_bid: "Bid Guarantee",
  guarantee_mobilization: "Mobilization Guarantee",
  guarantee_performance: "Performance Guarantee",
  general: "General / Other",
};

// The ordered checklist shown per-project (excludes the catch-all "general").
export const TENDER_DOC_CHECKLIST: DocumentCategory[] = [
  "tender_notice",
  "tender_documents",
  "prebid_meeting",
  "submitted_bid",
  "bid_comparative",
  "work_order",
  "signed_boq",
  "contract_agreement",
  "guarantee_bid",
  "guarantee_mobilization",
  "guarantee_performance",
];
