import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ILedgerEntry extends Document {
  date: Date;
  type: "income" | "expense";
  category: string;
  projectId?: Types.ObjectId;
  bankAccountId?: Types.ObjectId;
  vendorId?: Types.ObjectId;
  employeeId?: Types.ObjectId;
  amount: number;
  description?: string;
  paymentMode: "cash" | "bank_transfer" | "cheque";
  partyName?: string;
  partyType: "client" | "vendor" | "employee" | "other";
  referenceNumber?: string;
  receiptPath?: string;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ledgerEntrySchema = new Schema<ILedgerEntry>(
  {
    date: { type: Date, required: true },
    type: { type: String, enum: ["income", "expense"], required: true },
    category: { type: String, required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount" },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee" },
    amount: { type: Number, required: true },
    description: { type: String },
    paymentMode: {
      type: String,
      enum: ["cash", "bank_transfer", "cheque"],
      default: "cash",
    },
    partyName: { type: String },
    partyType: {
      type: String,
      enum: ["client", "vendor", "employee", "other"],
      default: "other",
    },
    referenceNumber: { type: String },
    receiptPath: { type: String },
    createdById: { type: Schema.Types.ObjectId, ref: "User" },
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

ledgerEntrySchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

ledgerEntrySchema.virtual("bankAccount", {
  ref: "BankAccount",
  localField: "bankAccountId",
  foreignField: "_id",
  justOne: true,
});

ledgerEntrySchema.virtual("vendor", {
  ref: "Vendor",
  localField: "vendorId",
  foreignField: "_id",
  justOne: true,
});

ledgerEntrySchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true,
});

ledgerEntrySchema.virtual("createdBy", {
  ref: "User",
  localField: "createdById",
  foreignField: "_id",
  justOne: true,
});

ledgerEntrySchema.index({ type: 1, date: -1 });
ledgerEntrySchema.index({ projectId: 1, type: 1 });
ledgerEntrySchema.index({ bankAccountId: 1, date: -1 });
ledgerEntrySchema.index({ date: -1 });
ledgerEntrySchema.index({ createdAt: -1 });

const LedgerEntry: Model<ILedgerEntry> =
  mongoose.models.LedgerEntry || mongoose.model<ILedgerEntry>("LedgerEntry", ledgerEntrySchema);

export default LedgerEntry;

