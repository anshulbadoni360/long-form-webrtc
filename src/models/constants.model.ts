import { Schema, model, InferSchemaType } from "mongoose";

const minMaxSchema = new Schema({
  min: Number,
  max: Number,
}, { _id: false });

const constantsSchema = new Schema({
  speaking: {
    type: Number,
    default: 0,
  },
  webcam: {
    type: Number,
    default: 0,
  },
  screenShare: {
    type: Number,
    default: 0,
  },
  engagementModifier: {
    type: Number,
    default: 0,
  },
  confidence: {
    type: minMaxSchema,
    default: { min: 0, max: 0 },
  },
  arousal: {
    type: minMaxSchema,
    default: { min: 0, max: 0 },
  },
  pitch: {
    type: minMaxSchema,
    default: { min: 0, max: 0 },
  },
  yaw: {
    type: minMaxSchema,
    default: { min: 0, max: 0 },
  },
  confStd: {
    type: Number,
    default: 0,
  },
  confAvg: {
    type: Number,
    default: 0,
  },
  confUpper: {
    type: Number,
    default: 0,
  },
  confLower: {
    type: Number,
    default: 0,
  },
  arousalStd: {
    type: Number,
    default: 0,
  },
  arousalAvg: {
    type: Number,
    default: 0,
  },
  arousalUpper: {
    type: Number,
    default: 0,
  },
  arousalLower: {
    type: Number,
    default: 0,
  },
  absPitchStd: {
    type: Number,
    default: 0,
  },
  absPitchAvg: {
    type: Number,
    default: 0,
  },
  absPitchUpper: {
    type: Number,
    default: 0,
  },
  absPitchLower: {
    type: Number,
    default: 0,
  },
  absYawStd: {
    type: Number,
    default: 0,
  },
  absYawAvg: {
    type: Number,
    default: 0,
  },
  absYawUpper: {
    type: Number,
    default: 0,
  },
  absYawLower: {
    type: Number,
    default: 0,
  },
});

export type ConstantsDocument = InferSchemaType<typeof constantsSchema>;
export const ConstantsModel = model<ConstantsDocument>("constants", constantsSchema, "constants");
