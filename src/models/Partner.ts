import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPartner extends Document {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  cnicOrCompanyReg?: string;
  equityPercent?: number;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const partnerSchema = new Schema<IPartner>(
  {
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    cnicOrCompanyReg: { type: String },
    // Optional ownership/equity share in the company — informational only,
    // not used in any calculation (kept simple; investments are tracked
    // separately, per-project, via the Investment model).
    equityPercent: { type: Number, min: 0, max: 100 },
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

partnerSchema.index({ name: 1 });
partnerSchema.index({ isActive: 1 });

const Partner: Model<IPartner> =
  mongoose.models.Partner || mongoose.model<IPartner>("Partner", partnerSchema);

export default Partner;
