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

// Normalize to midnight so "one record per employee per calendar day" can be
// enforced by a real unique index — without this, two records for the same
// employee/day but different times-of-day would both pass a naive unique
// index on the raw Date value.
attendanceSchema.pre("save", function (next) {
  if (this.isModified("date") && this.date) {
    const d = new Date(this.date);
    d.setHours(0, 0, 0, 0);
    this.date = d;
  }
  next();
});

attendanceSchema.index({ employeeId: 1, date: 1 }, { unique: true });
attendanceSchema.index({ projectId: 1, date: -1 });

const Attendance: Model<IAttendance> =
  mongoose.models.Attendance || mongoose.model<IAttendance>("Attendance", attendanceSchema);

export default Attendance;

