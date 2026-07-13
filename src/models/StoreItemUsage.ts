import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IStoreItemUsage extends Document {
  storeItemId: Types.ObjectId;
  quantityUsed: number;
  date: Date;
  purpose?: string;
  notes?: string;
  usedById?: Types.ObjectId;
  createdAt: Date;
}

const storeItemUsageSchema = new Schema<IStoreItemUsage>(
  {
    storeItemId: { type: Schema.Types.ObjectId, ref: "StoreItem", required: true },
    quantityUsed: { type: Number, required: true },
    date: { type: Date, default: Date.now },
    purpose: { type: String },
    notes: { type: String },
    usedById: { type: Schema.Types.ObjectId, ref: "User" },
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

storeItemUsageSchema.virtual("storeItem", {
  ref: "StoreItem",
  localField: "storeItemId",
  foreignField: "_id",
  justOne: true,
});

storeItemUsageSchema.virtual("usedBy", {
  ref: "User",
  localField: "usedById",
  foreignField: "_id",
  justOne: true,
});

storeItemUsageSchema.index({ storeItemId: 1 });
storeItemUsageSchema.index({ date: -1 });

const StoreItemUsage: Model<IStoreItemUsage> =
  mongoose.models.StoreItemUsage ||
  mongoose.model<IStoreItemUsage>("StoreItemUsage", storeItemUsageSchema);

export default StoreItemUsage;
