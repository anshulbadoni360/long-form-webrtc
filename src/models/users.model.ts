import mongoose, { Schema, InferSchemaType, HydratedDocument } from "mongoose";

const UserSchema = new Schema({
  ID: { type: String, required: true },
  ImageId: { type: String },
  MyImageId: { type: String },
  uuid: { type: String },
  stripeId: { type: String, default: "" },
  source: {
    type: String,
    enum: ["google", "microsoft", "monet"],
    default: "monet",
  },

  avatar: { type: String, default: "" },
  name: { type: String, required: true },
  email: { type: String },

  contact: { type: String, default: "" },
  gender: { type: String, default: "" },
  age: { type: Number, default: 0 },

  password: { type: String },
  resetPasswordToken: { type: String, default: "" },

  userType: {
    type: String,
    enum: ["student", "proctor", "teacher", "observer", "moderator"],
  },

  active: { type: Boolean, default: false },
  sid: { type: String, default: "" },
  roomid: { type: String, default: "" },

  address: { type: String, default: "" },
  city: { type: String, default: "" },
  state: { type: String, default: "" },
  pinCode: { type: String, default: "" },

  settings: {
    type: {
      waitingRoom: Boolean,
      screenShare: Boolean,
      chat: Boolean,
      limit: Number,
    },
    default: {
      waitingRoom: true,
      screenShare: true,
      chat: true,
      limit: 30,
    },
  },

  token: { type: String, default: "" },
  platform: { type: String, default: "monetlive" },

  plan: {
    id: {
      type: Schema.Types.ObjectId,
      ref: "plans",
      default: "61d279ea7b02f1835c9968df",
    },

    planUid: { type: Number, default: 0 },
    groupUid: { type: String, default: "" },
    name: { type: String, default: "Free Tier" },

    type: {
      type: String,
      enum: ["purchased", "assigned", "free", "expired"],
      default: "free",
    },

    assignedBy: { type: String, default: "" },
    licenseCount: { type: Number, default: 0 },
    assigned: { type: Number, default: 0 },

    assignees: {
      type: [
        {
          email: String,
          token: String,
          status: String,
          expiresAt: String,
        },
      ],
      default: [],
    },

    expiresAt: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setDate(date.getDate() + 14);
        return date;
      },
    },
  },

  cards: {
    type: [
      {
        stripeId: String,
        name: String,
        number: String,
        exp_month: String,
        exp_year: String,
        brand: String,
        type: String,
        fingerprint: String,
      },
    ],
    default: [],
  },

  lastPaymentIntendId: {
    type: String,
    default: "",
  },

  paymentHistory: {
    type: [
      {
        stripeIntentId: String,
        stripeChargeId: String,
        amount: String,
        description: String,
        currency: String,
        createdAt: Number,
        receiptUrl: String,
        status: String,
      },
    ],
    default: [],
  },

  googleAccessToken: { type: String, default: "" },
  googleRefreshToken: { type: String, default: "" },
  googleExpiresAt: { type: Number, default: 0 },

  microsoftAccessToken: { type: String },
  microsoftRefreshToken: { type: String },
  microsoftExpiresAt: { type: Number },
});

export type UserDocument = HydratedDocument<InferSchemaType<typeof UserSchema>>;

export const User = mongoose.model<UserDocument>("users", UserSchema);

export const buildUserLookup = (id: string) => ({
  $or: [
    { email: id },
    { uuid: id },
    { ID: id },
  ],
});

