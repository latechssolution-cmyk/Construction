import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEmployee extends Document {
  name: string;
  role: string;
  department?: string;
  phone?: string;
  email?: string;
  cnic?: string;
  address?: string;
  joiningDate?: Date | null;
  salary: number;
  salaryType: string;
  bankAccount?: string;
  emergencyContact?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const employeeSchema = new Schema<IEmployee>(
  {
    name: { type: String, required: true, trim: true },
    role: { type: String, required: true },
    department: { type: String },
    phone: { type: String },
    email: { type: String },
    cnic: { type: String },
    address: { type: String },
    joiningDate: { type: Date },
    salary: { type: Number, default: 0 },
    salaryType: { type: String, default: "monthly" },
    bankAccount: { type: String },
    emergencyContact: { type: String },
    notes: { type: String },
    isActive: { type: Boolean, default: true },
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

employeeSchema.virtual("projectAssignments", {
  ref: "ProjectEmployee",
  localField: "_id",
  foreignField: "employeeId",
});

employeeSchema.virtual("attendanceRecords", {
  ref: "Attendance",
  localField: "_id",
  foreignField: "employeeId",
});

employeeSchema.index({ name: 1 });
employeeSchema.index({ isActive: 1 });

const Employee: Model<IEmployee> =
  mongoose.models.Employee || mongoose.model<IEmployee>("Employee", employeeSchema);

export default Employee;

