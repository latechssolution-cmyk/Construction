import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISubcontract extends Document {
  projectId: Types.ObjectId;
  vendorId: Types.ObjectId;
  contractValue: number;
  status: "in_progress" | "completed";
  scopeOfWork?: string;
  notes?: string;
  startDate?: Date;
  endDate?: Date;
  completedAt?: Date | null;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const subcontractSchema = new Schema<ISubcontract>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor", required: true },
    contractValue: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["in_progress", "completed"], default: "in_progress" },
    scopeOfWork: { type: String },
    notes: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    completedAt: { type: Date, default: null },
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

subcontractSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

subcontractSchema.virtual("vendor", {
  ref: "Vendor",
  localField: "vendorId",
  foreignField: "_id",
  justOne: true,
});

subcontractSchema.virtual("createdBy", {
  ref: "User",
  localField: "createdById",
  foreignField: "_id",
  justOne: true,
});

subcontractSchema.index({ projectId: 1 });
subcontractSchema.index({ projectId: 1, status: 1 });
subcontractSchema.index({ vendorId: 1 });

const Subcontract: Model<ISubcontract> =
  mongoose.models.Subcontract || mongoose.model<ISubcontract>("Subcontract", subcontractSchema);

export default Subcontract;
