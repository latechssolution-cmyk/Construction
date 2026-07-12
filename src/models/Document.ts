import mongoose, { Schema, Document as MongooseDocument, Model, Types } from "mongoose";
import { DOCUMENT_CATEGORIES } from "@/lib/document-categories";

export interface IDocument extends MongooseDocument {
  projectId?: Types.ObjectId;
  name: string;
  type: string;
  category: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  description?: string;
  tags: string[];
  uploadedById?: Types.ObjectId;
  createdAt: Date;
}

const documentSchema = new Schema<IDocument>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project" },
    name: { type: String, required: true, trim: true },
    type: { type: String, default: "other" },
    category: { type: String, enum: DOCUMENT_CATEGORIES, default: "general" },
    fileUrl: { type: String },
    fileType: { type: String },
    fileSize: { type: Number },
    description: { type: String },
    tags: [{ type: String }],
    uploadedById: { type: Schema.Types.ObjectId, ref: "User" },
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

documentSchema.virtual("project", {
  ref: "Project",
  localField: "projectId",
  foreignField: "_id",
  justOne: true,
});

documentSchema.virtual("uploadedBy", {
  ref: "User",
  localField: "uploadedById",
  foreignField: "_id",
  justOne: true,
});

documentSchema.index({ projectId: 1 });
documentSchema.index({ createdAt: -1 });

const Doc: Model<IDocument> =
  mongoose.models.Document || mongoose.model<IDocument>("Document", documentSchema);

export default Doc;

