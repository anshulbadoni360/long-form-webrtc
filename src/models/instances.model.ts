import { Schema, model, InferSchemaType } from "mongoose";

const instanceSchema = new Schema({
  InstanceNo: { type: Number, required: true },
  InstanceRoute: { type: String, required: true },
  publicIP: { type: String, required: true },
  privateIP: { type: String, required: true },
  occupied: { type: Boolean, required: true },
  type: { type: String, enum: ["auto", "manual"], default: "manual" },
  CPU: { type: Number, default: 0 },
  RAM: { type: Number, default: 0 },
  Upload: { type: Number, default: 0 },
  Download: { type: Number, default: 0 },
  Calls: { type: Number, default: 0 },
  Participants: { type: Number, default: 0 },
  healthCheck: { type: String, enum: ["healthy", "unhealthy"], default: "healthy" },
});

export type InstanceDocument = InferSchemaType<typeof instanceSchema>;
export const Instance = model("instances", instanceSchema);
