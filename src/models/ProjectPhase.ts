import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IProjectPhase extends Document {
  projectId: Types.ObjectId;
  name: string;
  order: number;
  startDate?: Date | null;
  endDate?: Date | null;
  status: string;
  createdAt: Date;
}

const projectPhaseSchema = new Schema<IProjectPhase>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    startDate: { type: Date },
    endDate: { type: Date },
    status: { type: String, default: "pending" },
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

projectPhaseSchema.virtual("tasks", {
  ref: "Task",
  localField: "_id",
  foreignField: "phaseId",
});

projectPhaseSchema.index({ projectId: 1, order: 1 });

const ProjectPhase: Model<IProjectPhase> =
  mongoose.models.ProjectPhase ||
  mongoose.model<IProjectPhase>("ProjectPhase", projectPhaseSchema);

export default ProjectPhase;

