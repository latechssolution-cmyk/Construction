import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IContract extends Document {
  contractNumber: string;
  title: string;
  clientId: Types.ObjectId;
  scope?: string;
  contractValue: number;
  startDate?: Date | null;
  endDate?: Date | null;
  status: "draft" | "active" | "on_hold" | "completed" | "cancelled" | "terminated";
  paymentTerms?: string;
  documentPath?: string;
  notes?: string;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const contractSchema = new Schema<IContract>(
  {
    contractNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    clientId: { type: Schema.Types.ObjectId, ref: "Client", required: true },
    scope: { type: String },
    contractValue: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    status: {
      type: String,
      enum: ["draft", "active", "on_hold", "completed", "cancelled", "terminated"],
      default: "active",
    },
    paymentTerms: { type: String },
    documentPath: { type: String },
    notes: { type: String },
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

contractSchema.virtual("client", {
  ref: "Client",
  localField: "clientId",
  foreignField: "_id",
  justOne: true,
});

contractSchema.virtual("variations", {
  ref: "ContractVariation",
  localField: "_id",
  foreignField: "contractId",
});

contractSchema.virtual("totalValue").get(function(this: any) {
  const base = this.contractValue || 0;
  if (!this.variations || !Array.isArray(this.variations)) return base;
  return base + this.variations
    .filter((v: any) => v.status === "approved")
    .reduce((sum: number, v: any) => sum + (v.valueChange || 0), 0);
});

contractSchema.index({ clientId: 1 });
contractSchema.index({ status: 1 });
contractSchema.index({ createdAt: -1 });

const Contract: Model<IContract> =
  mongoose.models.Contract || mongoose.model<IContract>("Contract", contractSchema);

export default Contract;

