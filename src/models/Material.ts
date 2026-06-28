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
    totalPrice: { type: Number, required: true },
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

const Material: Model<IMaterial> =
  mongoose.models.Material || mongoose.model<IMaterial>("Material", materialSchema);

export default Material;

