import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISettings extends Document {
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  currency: string;
  taxPercent: number;
  retentionPercent: number;
  whtPercent: number;
  fiscalYearStart?: Date | null;
  updatedById?: mongoose.Types.ObjectId;
}

const settingsSchema = new Schema<ISettings>(
  {
    companyName: { type: String, required: true, default: "Vibrant Construction Co." },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    currency: { type: String, default: "PKR" },
    taxPercent: { type: Number, default: 16 }, // Standard sales tax (SRB/PRA)
    retentionPercent: { type: Number, default: 10 }, // Standard retention rate
    whtPercent: { type: Number, default: 7.5 }, // Standard withholding tax rate
    fiscalYearStart: { type: Date, default: null },
    updatedById: { type: Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
  }
);

const Settings: Model<ISettings> =
  mongoose.models.Settings || mongoose.model<ISettings>("Settings", settingsSchema);

export default Settings;
