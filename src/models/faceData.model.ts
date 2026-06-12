import { Schema, model, InferSchemaType } from "mongoose";

const faceDataSchema = new Schema({
  speaking: {
    type: Number,
    enum: [0, 1],
    default: 0,
  },
  segment: Number,
  uuid: String,
  roomid: String,
  engagement: {
    type: Number,
    default: 0,
  },
  mood: {
    type: Number,
    default: 0,
  },
  FaceAnalyzed: Boolean,
  FacialExpressions: {
    DominantBasicEmotion: String,
    BasicEmotions: {
      Neutral: Number,
      Happy: Number,
      Sad: Number,
      Angry: Number,
      Surprised: Number,
      Scared: Number,
      Disgusted: Number,
    },
    Valence: Number,
    Arousal: Number,
  },
  Characteristics: {
    Gender: {
      type: String,
    },
    Age: Number,
    Glasses: {
      type: String,
      default: "No",
    },
    Moustache: String,
    Beard: String,
  },
  Confidence: Number,
  HeadOrientation: [Number],
  BoundingBox: [Schema.Types.Mixed],
  NumberOfFaces: Number,
  ActionableEmotion: {
    type: String,
    default: "n/a",
  },
  webcam: {
    type: Number,
    enum: [0, 1],
    default: 0,
  },
  mic: {
    type: Number,
    enum: [0, 1],
    default: 0,
  },
  screen: {
    type: Number,
    enum: [0, 1],
    default: 0,
  },
  createdAt: Date,
});

export type FaceDataDocument = InferSchemaType<typeof faceDataSchema>;
export const FaceDataModel = model<FaceDataDocument>("fdModel", faceDataSchema, "face_data");
