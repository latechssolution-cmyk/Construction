import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ITask extends Document {
  projectId: Types.ObjectId;
  phaseId?: Types.ObjectId;
  title: string;
  description?: string;
  assignedToId?: Types.ObjectId;
  priority: string;
  dueDate?: Date | null;
  status: "todo" | "in_progress" | "on_hold" | "completed";
  estimatedHours?: number;
  actualHours?: number;
  completedAt?: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    phaseId: { type: Schema.Types.ObjectId, ref: "ProjectPhase" },
    title: { type: String, required: true },
    description: { type: String },
    assignedToId: { type: Schema.Types.ObjectId, ref: "User" },
    priority: { type: String, default: "medium" },
    dueDate: { type: Date },
    status: {
      type: String,
      enum: ["todo", "in_progress", "on_hold", "completed"],
      default: "todo",
    },
    estimatedHours: { type: Number },
    actualHours: { type: Number },
    completedAt: { type: Date },
    notes: { type: String },
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

taskSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

taskSchema.virtual("assignedTo", {
  ref: "User",
  localField: "assignedToId",
  foreignField: "_id",
  justOne: true,
});

taskSchema.virtual("phase", {
  ref: "ProjectPhase",
  localField: "phaseId",
  foreignField: "_id",
  justOne: true,
});

taskSchema.index({ projectId: 1, status: 1, dueDate: 1 });
taskSchema.index({ assignedToId: 1, status: 1 });
taskSchema.index({ dueDate: 1, status: 1 });

const Task: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>("Task", taskSchema);

export default Task;

