import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IProjectEquipment extends Document {
  projectId: Types.ObjectId;
  equipmentId: Types.ObjectId;
  assignedAt: Date;
  returnedAt?: Date | null;
  notes?: string;
}

const projectEquipmentSchema = new Schema<IProjectEquipment>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    equipmentId: { type: Schema.Types.ObjectId, ref: "Equipment", required: true },
    assignedAt: { type: Date, default: Date.now },
    returnedAt: { type: Date },
    notes: { type: String },
  },
  {
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

projectEquipmentSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

projectEquipmentSchema.virtual("equipment", {
  ref: "Equipment",
  localField: "equipmentId",
  foreignField: "_id",
  justOne: true,
});

projectEquipmentSchema.index({ equipmentId: 1, returnedAt: 1 });
projectEquipmentSchema.index({ projectId: 1 });

const ProjectEquipment: Model<IProjectEquipment> =
  mongoose.models.ProjectEquipment ||
  mongoose.model<IProjectEquipment>("ProjectEquipment", projectEquipmentSchema);

export default ProjectEquipment;

