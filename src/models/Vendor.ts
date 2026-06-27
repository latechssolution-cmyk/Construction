import mongoose, { Schema, Document, Model } from "mongoose";

export interface IVendor extends Document {
  name: string;
  category: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  bankAccount?: string;
  notes?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true, trim: true },
    category: { type: String, default: "general" },
    contactPerson: { type: String },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    taxId: { type: String },
    bankAccount: { type: String },
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

vendorSchema.index({ name: 1 });
vendorSchema.index({ isActive: 1 });

const Vendor: Model<IVendor> =
  mongoose.models.Vendor || mongoose.model<IVendor>("Vendor", vendorSchema);

export default Vendor;

