import { Schema, model, InferSchemaType } from "mongoose";

const planSchema = new Schema({
  planUid: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  participantCapacity: {
    type: Number,
    required: true,
  },
  licenseCount: {
    type: Number,
    required: true,
  },
  meetingDuration: {
    type: Number,
    required: true,
  },
  noOfMeetingHours: {
    type: Number,
    required: true,
  },
  waitingRoom: {
    type: Boolean,
    required: true,
  },
  realTimeScores: {
    type: Number,
    required: true,
  },
  postMeetingAnalytics: {
    type: Boolean,
    required: true,
  },
  recording: {
    type: Boolean,
    required: true,
  },
  observerAccess: {
    type: Boolean,
    required: true,
  },
  technicalSupport: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  currency: {
    type: String,
    required: true,
  },
  stripeId: {
    type: String,
    required: true,
  },
  stripeProductId: {
    type: String,
    required: true,
  },
  stripePriceId: {
    type: String,
    required: true,
  },
  expiresIn: {
    type: Number,
    required: true,
  },
});

export type PlanDocument = InferSchemaType<typeof planSchema>;
export const Plan = model("plans", planSchema);
