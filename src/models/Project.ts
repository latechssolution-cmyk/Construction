import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IProject extends Document {
  name: string;
  location?: string;
  description?: string;
  type: "residential" | "commercial" | "industrial" | "renovation" | "infrastructure" | "other";
  clientId?: Types.ObjectId;
  assignedManagerId?: Types.ObjectId;
  contractId?: Types.ObjectId;
  budget: number;
  completionPercent: number;
  status: "planning" | "in_progress" | "on_hold" | "completed" | "cancelled";
  startDate?: Date | null;
  endDate?: Date | null;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String },
    description: { type: String },
    type: {
      type: String,
      enum: ["residential", "commercial", "industrial", "renovation", "infrastructure", "other"],
      default: "residential",
    },
    clientId: { type: Schema.Types.ObjectId, ref: "Client" },
    assignedManagerId: { type: Schema.Types.ObjectId, ref: "User" },
    contractId: { type: Schema.Types.ObjectId, ref: "Contract" },
    budget: { type: Number, default: 0 },
    completionPercent: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["planning", "in_progress", "on_hold", "completed", "cancelled"],
      default: "planning",
    },
    startDate: { type: Date },
    endDate: { type: Date },
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

projectSchema.virtual("client", {
  ref: "Client",
  localField: "clientId",
  foreignField: "_id",
  justOne: true,
});

projectSchema.virtual("assignedManager", {
  ref: "User",
  localField: "assignedManagerId",
  foreignField: "_id",
  justOne: true,
});

projectSchema.virtual("contract", {
  ref: "Contract",
  localField: "contractId",
  foreignField: "_id",
  justOne: true,
});

projectSchema.virtual("phases", {
  ref: "ProjectPhase",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("tasks", {
  ref: "Task",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("milestones", {
  ref: "Milestone",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("materials", {
  ref: "Material",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("employees", {
  ref: "ProjectEmployee",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("equipment", {
  ref: "ProjectEquipment",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("ledgerEntries", {
  ref: "LedgerEntry",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("invoices", {
  ref: "Invoice",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("documents", {
  ref: "Document",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.virtual("subcontracts", {
  ref: "Subcontract",
  localField: "_id",
  foreignField: "projectId",
});

projectSchema.index({ status: 1 });
projectSchema.index({ assignedManagerId: 1 });
projectSchema.index({ clientId: 1 });
projectSchema.index({ createdAt: -1 });

const Project: Model<IProject> =
  mongoose.models.Project || mongoose.model<IProject>("Project", projectSchema);

export default Project;

