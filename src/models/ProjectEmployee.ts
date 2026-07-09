import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IProjectEmployee extends Document {
  projectId: Types.ObjectId;
  employeeId: Types.ObjectId;
  role?: string;
  startDate: Date;
  endDate?: Date | null;
}

const projectEmployeeSchema = new Schema<IProjectEmployee>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    role: { type: String },
    startDate: { type: Date, default: Date.now },
    endDate: { type: Date },
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

projectEmployeeSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

projectEmployeeSchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true,
});

projectEmployeeSchema.index({ projectId: 1, employeeId: 1 }, { unique: true });
// The Employees list page queries by employeeId (with an $in across a page
// of employees) + endDate, not projectId — the compound index above can't
// be used efficiently for that access pattern since employeeId isn't its
// leading field.
projectEmployeeSchema.index({ employeeId: 1, endDate: 1 });

const ProjectEmployee: Model<IProjectEmployee> =
  mongoose.models.ProjectEmployee ||
  mongoose.model<IProjectEmployee>("ProjectEmployee", projectEmployeeSchema);

export default ProjectEmployee;

