import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMilestone extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string | null;
  dueDate?: Date | null;
  completedAt?: Date | null;
  createdAt: Date;
}

const milestoneSchema = new Schema<IMilestone>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    description: { type: String, default: null },
    dueDate: { type: Date },
    completedAt: { type: Date },
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

milestoneSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

milestoneSchema.index({ projectId: 1 });
milestoneSchema.index({ dueDate: 1 });

const Milestone: Model<IMilestone> =
  mongoose.models.Milestone || mongoose.model<IMilestone>("Milestone", milestoneSchema);

export default Milestone;
