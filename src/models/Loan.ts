import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const LOAN_BORROWER_TYPES = ["employee", "vendor", "client", "partner", "other"] as const;
export const LOAN_STATUSES = ["active", "partially_repaid", "repaid", "written_off"] as const;

export interface ILoan extends Document {
  borrowerType: (typeof LOAN_BORROWER_TYPES)[number];
  borrowerId?: Types.ObjectId;
  borrowerName: string;
  principalAmount: number;
  issueDate: Date;
  expectedReturnDate?: Date | null;
  bankAccountId?: Types.ObjectId;
  status: (typeof LOAN_STATUSES)[number];
  notes?: string;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const loanSchema = new Schema<ILoan>(
  {
    borrowerType: { type: String, enum: LOAN_BORROWER_TYPES, required: true },
    // Reference is optional — a loan can be given to someone not yet in the
    // system (e.g. a one-off "other" party) as long as a name is recorded.
    borrowerId: { type: Schema.Types.ObjectId },
    borrowerName: { type: String, required: true, trim: true },
    principalAmount: { type: Number, required: true, min: 0 },
    issueDate: { type: Date, default: Date.now },
    expectedReturnDate: { type: Date },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount" },
    status: { type: String, enum: LOAN_STATUSES, default: "active" },
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

loanSchema.virtual("bankAccount", {
  ref: "BankAccount",
  localField: "bankAccountId",
  foreignField: "_id",
  justOne: true,
});

loanSchema.virtual("repayments", {
  ref: "LoanRepayment",
  localField: "_id",
  foreignField: "loanId",
});

loanSchema.index({ status: 1 });
loanSchema.index({ borrowerType: 1, borrowerId: 1 });
loanSchema.index({ issueDate: -1 });

const Loan: Model<ILoan> =
  mongoose.models.Loan || mongoose.model<ILoan>("Loan", loanSchema);

export default Loan;
