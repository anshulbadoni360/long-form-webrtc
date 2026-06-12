import fs from "node:fs";
import { Schema, model, InferSchemaType } from "mongoose";

const basePath = "/mnt/efs/fs1/data/";

const sessionSchema = new Schema({
  active: {
    type: Boolean,
    default: false,
  },
  proctor: {
    type: String,
    enum: ["student", "manager", "teacher", "observer", "cohost"],
    default: "student",
  },
  group: {
    type: String,
    default: "main",
  },
  sid: {
    type: String,
    default: "",
  },
  pubID: {
    type: Number,
    default: -1,
  },
  email: {
    type: String,
    default: "",
  },
  faceId: { type: String },
  uuid: { type: String, required: true },
  roomid: { type: String, required: true },
  name: { type: String, required: true },
  time: { type: String, required: true },
  serverIP: { type: String, required: true },
  raiseHand: { type: Boolean, default: false },
  janus: {
    roomid: { type: Number },
    webcam: { type: Boolean, default: false },
    screen: { type: Boolean, default: false },
    audio: { type: Boolean, default: false },
    hidden: { type: Boolean, default: false },
    audio_start: {
      type: Date,
      default() {
        return new Date();
      },
    },
    audio_stop: { type: Date, default: new Date() },
    video: { type: Boolean, default: false },
    video_start: {
      type: Date,
      default() {
        return new Date();
      },
    },
    video_stop: { type: Date, default: new Date() },
    group_id: { type: String, default: null }
  },
  video_postprocessing: {
    status: { type: Boolean, default: false },
    created_on: {
      type: String,
      default() {
        if (this.video_postprocessing?.status === true) {
          return new Date().toString();
        }
        return "NaN";
      },
    },
    path: {
      type: String,
      default() {
        if (fs.existsSync(`${basePath}${this.uuid}-webcam-video-0.mjr`)) {
          if (fs.existsSync(`${basePath}${this.uuid}-final-webcam.webm`)) {
            return `${basePath}${this.uuid}-final-webcam.webm`;
          }
          return "error";
        }
        return "NaN";
      },
    },
  },
  screen_postprocessing: {
    status: { type: Boolean, default: false },
    created_on: {
      type: String,
      default() {
        if (this.screen_postprocessing?.status === true) {
          return new Date().toString();
        }
        return "NaN";
      },
    },
    path: {
      type: String,
      default() {
        if (
          fs.existsSync(`${basePath}${this.uuid}___${this.uuid}-screen-video-0.mjr`) ||
          fs.existsSync(`${basePath}${this.uuid}___${this.uuid}-screen-video-1.mjr`)
        ) {
          if (fs.existsSync(`${basePath}${this.uuid}___${this.uuid}-screen.webm`)) {
            return `${basePath}${this.uuid}___${this.uuid}-screen.webm`;
          }
          if (fs.existsSync(`${basePath}${this.uuid}-screen-final-webcam.webm`)) {
            return `${basePath}${this.uuid}-screen-final-webcam.webm`;
          }
          return "error";
        }
        return "NaN";
      },
    },
  },
});

sessionSchema.pre("save", function (this: any) {
  if (!this.janus) {
    this.janus = {};
  }
  if (!this.janus.roomid && this.roomid) {
    this.janus.roomid = parseInt(this.roomid, 10) || 0;
  }
});

export type SessionDocument = InferSchemaType<typeof sessionSchema>;
export const Sessions = model<SessionDocument>("sessions", sessionSchema, "sessions");
