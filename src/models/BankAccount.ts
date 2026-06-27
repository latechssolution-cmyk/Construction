import mongoose, { Schema, Document, Model } from "mongoose";

export interface IBankAccount extends Document {
  name: string;
  bankName?: string;
  accountNumber?: string;
  accountType: string;
  balance: number;
  currency: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const bankAccountSchema = new Schema<IBankAccount>(
  {
    name: { type: String, required: true, trim: true },
    bankName: { type: String },
    accountNumber: { type: String },
    accountType: { type: String, default: "current" },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: "PKR" },
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

bankAccountSchema.virtual("ledgerEntries", {
  ref: "LedgerEntry",
  localField: "_id",
  foreignField: "bankAccountId",
});

bankAccountSchema.index({ isActive: 1 });
bankAccountSchema.index({ name: 1 });

const BankAccount: Model<IBankAccount> =
  mongoose.models.BankAccount || mongoose.model<IBankAccount>("BankAccount", bankAccountSchema);

export default BankAccount;

