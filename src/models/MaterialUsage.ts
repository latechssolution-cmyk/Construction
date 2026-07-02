import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMaterialUsage extends Document {
  materialId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  quantityUsed: number;
  date: Date;
  purpose?: string;
  notes?: string;
  usedById?: Types.ObjectId;
  createdAt: Date;
}

const materialUsageSchema = new Schema<IMaterialUsage>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "Material", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    quantityUsed: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    purpose: { type: String },
    notes: { type: String },
    usedById: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
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

materialUsageSchema.virtual("material", {
  ref: "Material",
  localField: "materialId",
  foreignField: "_id",
  justOne: true,
});

materialUsageSchema.virtual("usedBy", {
  ref: "User",
  localField: "usedById",
  foreignField: "_id",
  justOne: true,
});

materialUsageSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

materialUsageSchema.index({ materialId: 1 });
materialUsageSchema.index({ projectId: 1 });
materialUsageSchema.index({ date: -1 });

const MaterialUsage: Model<IMaterialUsage> =
  mongoose.models.MaterialUsage ||
  mongoose.model<IMaterialUsage>("MaterialUsage", materialUsageSchema);

export default MaterialUsage;

