import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IMaterial extends Document {
  projectId: Types.ObjectId;
  vendorId?: Types.ObjectId;
  itemName: string;
  category: string;
  quantity: number;
  stockQuantity: number;
  minStockLevel: number;
  unit: string;
  unitPrice: number;
  /** Computed virtual: quantity × unitPrice */
  totalPrice: number;
  receivedDate: Date;
  receiptPath?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const materialSchema = new Schema<IMaterial>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    vendorId: { type: Schema.Types.ObjectId, ref: "Vendor" },
    itemName: { type: String, required: true },
    category: { type: String, default: "general" },
    quantity: { type: Number, required: true },
    stockQuantity: { type: Number, default: 0 },
    minStockLevel: { type: Number, default: 5 },
    unit: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    // totalPrice is a virtual — not stored — to prevent quantity×unitPrice mismatches
    receivedDate: { type: Date, default: Date.now },
    receiptPath: { type: String },
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

materialSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

materialSchema.virtual("vendor", {
  ref: "Vendor",
  localField: "vendorId",
  foreignField: "_id",
  justOne: true,
});

materialSchema.virtual("usageLogs", {
  ref: "MaterialUsage",
  localField: "_id",
  foreignField: "materialId",
});

materialSchema.index({ projectId: 1, stockQuantity: 1 });
materialSchema.index({ itemName: 1 });

// Virtual: totalPrice computed from quantity × unitPrice (Issue #79)
materialSchema.virtual("totalPrice").get(function (this: IMaterial) {
  return (this.quantity || 0) * (this.unitPrice || 0);
});

// Pre-save: initialize stockQuantity from quantity when creating (Issue #80)
materialSchema.pre("save", function (next) {
  // Only set stockQuantity on new documents where it has not been manually set
  if (this.isNew && (this.stockQuantity === undefined || this.stockQuantity === 0)) {
    this.stockQuantity = this.quantity;
  }
  next();
});

const Material: Model<IMaterial> =
  mongoose.models.Material || mongoose.model<IMaterial>("Material", materialSchema);

export default Material;

