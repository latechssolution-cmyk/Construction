import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ILoanRepayment extends Document {
  loanId: Types.ObjectId;
  amount: number;
  date: Date;
  bankAccountId?: Types.ObjectId;
  notes?: string;
  createdById?: Types.ObjectId;
  createdAt: Date;
}

const loanRepaymentSchema = new Schema<ILoanRepayment>(
  {
    loanId: { type: Schema.Types.ObjectId, ref: "Loan", required: true },
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    bankAccountId: { type: Schema.Types.ObjectId, ref: "BankAccount" },
    notes: { type: String },
    createdById: { type: Schema.Types.ObjectId, ref: "User" },
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

loanRepaymentSchema.index({ loanId: 1, date: -1 });

const LoanRepayment: Model<ILoanRepayment> =
  mongoose.models.LoanRepayment || mongoose.model<ILoanRepayment>("LoanRepayment", loanRepaymentSchema);

export default LoanRepayment;
