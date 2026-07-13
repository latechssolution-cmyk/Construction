import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IInvestment extends Document {
  partnerId: Types.ObjectId;
  projectId: Types.ObjectId;
  amount: number;
  date: Date;
  bankAccountId?: Types.ObjectId;
  notes?: string;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const investmentSchema = new Schema<IInvestment>(
  {
    partnerId: { type: Schema.Types.ObjectId, ref: "Partner", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount" },
    notes: { type: String },
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

investmentSchema.virtual("partner", {
  ref: "Partner",
  localField: "partnerId",
  foreignField: "_id",
  justOne: true,
});

investmentSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

investmentSchema.virtual("bankAccount", {
  ref: "BankAccount",
  localField: "bankAccountId",
  foreignField: "_id",
  justOne: true,
});

investmentSchema.index({ projectId: 1, date: -1 });
investmentSchema.index({ partnerId: 1, date: -1 });

const Investment: Model<IInvestment> =
  mongoose.models.Investment || mongoose.model<IInvestment>("Investment", investmentSchema);

export default Investment;
