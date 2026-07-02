import mongoose, { Schema, Document } from "mongoose";

export interface ICounter extends Document<string> {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

/**
 * Counter model for sequential auto-incrementing number generation.
 * Used to generate collision-free invoice and contract numbers.
 * Key format: "INV-{year}-{month}" or "CNT-{year}-{month}"
 */
const Counter =
  mongoose.models.Counter ||
  mongoose.model<ICounter>("Counter", counterSchema);

export default Counter;
