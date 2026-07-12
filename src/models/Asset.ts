import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const ASSET_CATEGORIES = [
  "land",
  "building",
  "vehicle",
  "machinery",
  "it_equipment",
  "furniture",
  "other",
] as const;

export const ASSET_STATUSES = ["in_use", "idle", "under_maintenance", "disposed"] as const;

export interface IAsset extends Document {
  name: string;
  assetCode?: string;
  category: (typeof ASSET_CATEGORIES)[number];
  purchaseDate?: Date | null;
  purchaseCost: number;
  usefulLifeYears: number;
  salvageValue: number;
  status: (typeof ASSET_STATUSES)[number];
  location?: string;
  assignedTo?: string;
  lastMaintenanceDate?: Date | null;
  nextMaintenanceDate?: Date | null;
  notes?: string;
  createdById?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assetSchema = new Schema<IAsset>(
  {
    name: { type: String, required: true, trim: true },
    assetCode: { type: String, trim: true },
    category: { type: String, enum: ASSET_CATEGORIES, default: "other" },
    purchaseDate: { type: Date },
    purchaseCost: { type: Number, default: 0, min: 0 },
    // Years of useful life for straight-line depreciation. Land is typically
    // non-depreciable — set a large life (or leave salvage = cost) for land.
    usefulLifeYears: { type: Number, default: 5, min: 0 },
    salvageValue: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ASSET_STATUSES, default: "in_use" },
    location: { type: String },
    assignedTo: { type: String },
    lastMaintenanceDate: { type: Date },
    nextMaintenanceDate: { type: Date },
    notes: { type: String },
    createdById: { type: Schema.Types.ObjectId, ref: "User" },
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

// Straight-line accumulated depreciation to date, capped at the depreciable
// base (cost − salvage). Computed, never stored, so book value is always
// correct as of "now" without a nightly job.
assetSchema.virtual("accumulatedDepreciation").get(function (this: IAsset) {
  const cost = this.purchaseCost || 0;
  const salvage = Math.min(this.salvageValue || 0, cost);
  const life = this.usefulLifeYears || 0;
  if (life <= 0 || !this.purchaseDate) return 0;
  const ageMs = Date.now() - new Date(this.purchaseDate).getTime();
  const ageYears = Math.max(0, ageMs / (365.25 * 24 * 60 * 60 * 1000));
  const depreciable = cost - salvage;
  const dep = (depreciable * ageYears) / life;
  return Math.min(Math.max(dep, 0), depreciable);
});

assetSchema.virtual("currentBookValue").get(function (this: any) {
  const cost = this.purchaseCost || 0;
  return Math.round((cost - (this.accumulatedDepreciation || 0)) * 100) / 100;
});

assetSchema.index({ status: 1 });
assetSchema.index({ category: 1 });
assetSchema.index({ nextMaintenanceDate: 1 });

const Asset: Model<IAsset> =
  mongoose.models.Asset || mongoose.model<IAsset>("Asset", assetSchema);

export default Asset;
