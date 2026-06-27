import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IEquipmentMaintenance extends Document {
  equipmentId: Types.ObjectId;
  projectId?: Types.ObjectId;
  cost: number;
  description?: string;
  date: Date;
  createdAt: Date;
}

const equipmentMaintenanceSchema = new Schema<IEquipmentMaintenance>(
  {
    equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    cost: { type: Number, default: 0 },
    description: { type: String },
    date: { type: Date, default: Date.now },
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

equipmentMaintenanceSchema.index({ equipmentId: 1, date: -1 });

const EquipmentMaintenance: Model<IEquipmentMaintenance> =
  mongoose.models.EquipmentMaintenance ||
  mongoose.model<IEquipmentMaintenance>("EquipmentMaintenance", equipmentMaintenanceSchema);

export default EquipmentMaintenance;

