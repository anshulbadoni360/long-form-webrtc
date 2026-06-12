import fs from "node:fs";
import { Schema, model, InferSchemaType } from "mongoose";

const basePath = process.env.MOSAIC_BASE_PATH || "";

const roomSchema = new Schema({
  creator: { type: String },
  creator_ID: { type: String, required: true },
  source: {
    type: String,
    enum: ["google", "outlook", "monet"],
    default: "monet",
  },
  scheduled: {
    type: Boolean,
    default: false,
    required: true,
  },
  sourceId: { type: String },
  name: {
    type: String,
    default: "-",
  },
  room: {
    type: String,
    default: "0",
  },
  roomid: {
    type: String,
    default: "0",
  },
  alive: {
    type: Number,
    enum: [0, 1, 2],
    default: 1,
  },
  summary: {
    type: String,
    default: "-",
  },
  start: {
    dateTime: {
      type: Date,
      default: Date.now,
    },
    timeZone: {
      type: String,
    },
  },
  end: {
    dateTime: {
      type: Date,
      default: Date.now,
    },
    timeZone: {
      type: String,
    },
  },
  attendees: [String],
  link: {
    type: String,
  },
  url: {
    type: String,
  },
  description: {
    type: String,
  },
  location: {
    type: String,
  },
  organizer: {
    type: String,
  },
  observerEmail: {
    type: String,
    default: "",
  },
  multiObserversEmail: {
    type: [String],
    default: [],
  },
  cohosts: {
    type: [String],
    default: [],
  },
  observers: {
    type: [String],
    default: [],
  },
  observerLink: {
    type: String,
    default: "",
  },
  observing: {
    type: Boolean,
    default: false,
  },
  settings: {
    type: {
      waitingRoom: Boolean,
      screenShare: Boolean,
      chat: Boolean,
      limit: Number,
    },
    default: { waitingRoom: true, screenShare: true, chat: true, limit: 30 },
  },
  mosaic: {
    status: { type: Boolean, default: false },
    created_on: {
      type: String,
      default() {
        if (this.mosaic.status === true) return new Date().toString();
        return "NaN";
      },
    },
    path: {
      type: String,
      default() {
        if (this.mosaic.status === true) {
          if (fs.existsSync(`${basePath}${this.roomid}-final-mosaic.mp4`))
            return `${basePath}${this.roomid}-final-mosaic.mp4`;
          if (fs.existsSync(`${basePath}${this.roomid}-mosaic.mp4`))
            return `${basePath}${this.roomid}-mosaic.mp4`;
          return "error";
        }
        return "NaN";
      },
    },
  },
  grp: {
    type: String,
    default: "",
  },
  instance: {
    type: String,
    default: "",
  },
  schedule_meeting_id: {
    type: String,
    default: "",
  },
  excludeMeeting: {
    type: Boolean,
    default: false,
  },
  study_id: {
    type: Schema.Types.ObjectId,
    ref: "studies",
  },
});

export type RoomDocument = InferSchemaType<typeof roomSchema>;

export const Room = model<RoomDocument>("rooms", roomSchema, "rooms");
