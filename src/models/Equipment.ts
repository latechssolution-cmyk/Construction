import mongoose, { Schema, Document, Model } from "mongoose";

export interface IEquipment extends Omit<Document, "model"> {
  name: string;
  type: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date | null;
  purchasePrice?: number;
  condition: "excellent" | "good" | "fair" | "poor";
  status: "available" | "in_use" | "maintenance" | "decommissioned";
  location?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const equipmentSchema = new Schema<IEquipment>(
  {
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, enum: ["excavator","crane","bulldozer","loader","mixer","generator","scaffold","scaffolding","pump","compactor","truck","vehicle","forklift","drill","welder","other"] },
    model: { type: String },
    serialNumber: { type: String },
    purchaseDate: { type: Date },
    purchasePrice: { type: Number },
    condition: {
      type: String,
      enum: ["excellent", "good", "fair", "poor"],
      default: "good",
    },
    status: {
      type: String,
      enum: ["available", "in_use", "maintenance", "decommissioned"],
      default: "available",
    },
    location: { type: String },
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

equipmentSchema.virtual("assignments", {
  ref: "ProjectEquipment",
  localField: "_id",
  foreignField: "equipmentId",
});

equipmentSchema.virtual("maintenance", {
  ref: "EquipmentMaintenance",
  localField: "_id",
  foreignField: "equipmentId",
});

equipmentSchema.index({ status: 1 });
equipmentSchema.index({ name: 1 });

const Equipment: Model<IEquipment> =
  mongoose.models.Equipment || mongoose.model<IEquipment>("Equipment", equipmentSchema);

export default Equipment;

