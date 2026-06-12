import { Schema, model, InferSchemaType, Types } from "mongoose";

const planGroupsSchema = new Schema({
  uid: {
    type: String,
    required: true,
    unique: true,
  },
  usedHours: {
    type: Number,
    default: 0,
  },
  totalHours: {
    type: Number,
    required: true,
  },
  users: {
    type: [
      {
        id: {
          type: Schema.Types.ObjectId,
          ref: "users",
        },
        name: String,
        email: String,
      },
    ],
    default: [],
  },
  logs: {
    type: [
      {
        who: {
          id: {
            type: Schema.Types.ObjectId,
            ref: "users",
          },
          name: String,
          email: String,
        },
        hours: String,
      },
    ],
    default: [],
  },
});

export type PlanGroupDocument = InferSchemaType<typeof planGroupsSchema>;
export const PlanGroup = model("planGroups", planGroupsSchema);
