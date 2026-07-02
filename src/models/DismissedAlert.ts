import mongoose, { Schema, Document, Model } from "mongoose";

export interface IDismissedAlert extends Document {
  userId: mongoose.Types.ObjectId;
  alertKey: string; // The synthetic ID, e.g., "task-123"
  createdAt: Date;
}

const dismissedAlertSchema = new Schema<IDismissedAlert>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    alertKey: { type: String, required: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Unique compound index to prevent duplicate dismissal records
dismissedAlertSchema.index({ userId: 1, alertKey: 1 }, { unique: true });

const DismissedAlert: Model<IDismissedAlert> =
  mongoose.models.DismissedAlert ||
  mongoose.model<IDismissedAlert>("DismissedAlert", dismissedAlertSchema);

export default DismissedAlert;
