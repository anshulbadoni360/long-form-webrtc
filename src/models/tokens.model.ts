import { Schema, model, InferSchemaType } from "mongoose";

const tokenSchema = new Schema({
  token: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    default() {
      return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    },
  },
});

export type TokenDocument = InferSchemaType<typeof tokenSchema>;
export const TokenModel = model<TokenDocument>("tokens", tokenSchema, "tokens");
