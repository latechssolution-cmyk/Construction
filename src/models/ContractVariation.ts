import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IContractVariation extends Document {
  contractId: Types.ObjectId;
  variationNumber: string;
  title: string;
  description?: string;
  valueChange: number; // positive for addition, negative for reduction
  approvalDate: Date;
  status: "pending" | "approved" | "rejected";
  approvedById?: Types.ObjectId;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const contractVariationSchema = new Schema<IContractVariation>(
  {
    contractId: { type: Schema.Types.ObjectId, ref: "Contract", required: true },
    variationNumber: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String },
    valueChange: { type: Number, required: true, default: 0 },
    approvalDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    approvedById: { type: Schema.Types.ObjectId, ref: "User" },
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

const ContractVariation: Model<IContractVariation> =
  mongoose.models.ContractVariation ||
  mongoose.model<IContractVariation>("ContractVariation", contractVariationSchema);

export default ContractVariation;
