import mongoose, { Schema, Document, Model, Types } from "mongoose";

// Company-wide inventory (office/general supplies, spares, consumables) —
// the same shape as Material but intentionally has no projectId. Material
// stays project-scoped (required projectId, feeds project budgets); Store
// is the company's general stock, not attributable to any one project.
export interface IStoreItem extends Document {
  itemName: string;
  category: string;
  quantity: number;
  stockQuantity: number;
  minStockLevel: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  vendorId?: Types.ObjectId;
  receivedDate: Date;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const storeItemSchema = new Schema<IStoreItem>(
  {
    itemName: { type: String, required: true, trim: true },
    category: { type: String, default: "general" },
    quantity: { type: Number, required: true },
    stockQuantity: { type: Number, default: 0 },
    minStockLevel: { type: Number, default: 5 },
    unit: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    receivedDate: { type: Date, default: Date.now },
    notes: { type: String },
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

storeItemSchema.virtual("vendor", {
  ref: "Vendor",
  localField: "vendorId",
  foreignField: "_id",
  justOne: true,
});

storeItemSchema.virtual("usageLogs", {
  ref: "StoreItemUsage",
  localField: "_id",
  foreignField: "storeItemId",
});

storeItemSchema.virtual("totalPrice").get(function (this: IStoreItem) {
  return (this.quantity || 0) * (this.unitPrice || 0);
});

storeItemSchema.pre("save", function (next) {
  if (this.isNew && (this.stockQuantity === undefined || this.stockQuantity === 0)) {
    this.stockQuantity = this.quantity;
  }
  next();
});

storeItemSchema.index({ stockQuantity: 1 });
storeItemSchema.index({ itemName: 1 });

const StoreItem: Model<IStoreItem> =
  mongoose.models.StoreItem || mongoose.model<IStoreItem>("StoreItem", storeItemSchema);

export default StoreItem;
