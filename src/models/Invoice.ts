import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IInvoiceItem {
  _id?: Types.ObjectId;
  id?: string;
  description: string;
  quantity: number;
  unit?: string;
  unitPrice: number;
  total: number;
}

export interface IInvoice extends Document {
  invoiceNumber: string;
  projectId?: Types.ObjectId;
  clientId?: Types.ObjectId;
  issueDate: Date;
  dueDate?: Date | null;
  paidAt?: Date | null;
  paidAmount?: number;
  deletedAt?: Date | null;
  status: "draft" | "sent" | "paid" | "overdue" | "cancelled";
  subtotal: number;
  taxPercent: number;
  taxAmount: number;
  retentionPercent: number;
  retentionAmount: number;
  whtDeducted: number;
  grandTotal: number;
  notes?: string;
  paymentTerms?: string;
  createdById?: Types.ObjectId;
  items: IInvoiceItem[];
  createdAt: Date;
  updatedAt: Date;
}

const invoiceItemSchema = new Schema<IInvoiceItem>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unit: { type: String },
    unitPrice: { type: Number, required: true },
    total: { type: Number, required: true },
  },
  {
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_, ret) {
        ret.id = ret._id?.toString();
        delete (ret as any)._id;
      },
    },
  }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String, required: true, unique: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    issueDate: { type: Date, default: Date.now },
    dueDate: { type: Date },
    paidAt: { type: Date },
    // "issued" and "partially_paid" were removed — neither had a UI path to
    // reach them nor a transition out of them, so an invoice could get
    // permanently stuck. Add them back only alongside real partial-payment
    // tracking (an amountPaid field + endpoint) and a corresponding transition.
    status: {
      type: String,
      enum: ["draft", "sent", "paid", "overdue", "cancelled"],
      default: "draft",
    },
    subtotal: { type: Number, default: 0 },
    taxPercent: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    retentionPercent: { type: Number, default: 0 },
    retentionAmount: { type: Number, default: 0 },
    whtDeducted: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    notes: { type: String },
    paymentTerms: { type: String },
    createdById: { type: Schema.Types.ObjectId, ref: "User" },
    items: [invoiceItemSchema],
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      versionKey: false,
      transform(_, ret) {
        ret.id = ret._id?.toString();
        delete (ret as any)._id;
      },
    },
  }
);

invoiceSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

invoiceSchema.virtual("client", {
  ref: "Client",
  localField: "clientId",
  foreignField: "_id",
  justOne: true,
});

invoiceSchema.virtual("createdBy", {
  ref: "User",
  localField: "createdById",
  foreignField: "_id",
  justOne: true,
});

invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ clientId: 1, status: 1 });
invoiceSchema.index({ projectId: 1 });
invoiceSchema.index({ createdAt: -1 });

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", invoiceSchema);

export default Invoice;

