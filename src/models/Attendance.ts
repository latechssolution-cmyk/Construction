import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAttendance extends Document {
  employeeId: Types.ObjectId;
  projectId?: Types.ObjectId;
  date: Date;
  status: "present" | "absent" | "half_day";
  hoursWorked: number;
  notes?: string;
  createdAt: Date;
}

const attendanceSchema = new Schema<IAttendance>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: "Employee", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: ["present", "absent", "half_day"],
      default: "present",
    },
    hoursWorked: { type: Number, default: 0 },
    notes: { type: String },
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

attendanceSchema.virtual("employee", {
  ref: "Employee",
  localField: "employeeId",
  foreignField: "_id",
  justOne: true,
});

attendanceSchema.index({ employeeId: 1, date: -1 });
attendanceSchema.index({ projectId: 1, date: -1 });

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", attendanceSchema);

export default Attendance;

