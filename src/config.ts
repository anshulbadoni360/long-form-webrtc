import path from "node:path";

const recordingPath = process.env.BASE_URL === "dev.monetlive.com" ? "/tmp" : path.resolve("./tmp");

export const db = "./proctoring.json";
export const data = recordingPath;

export const web = {
  http: 8092,
  https: 8093,
  certs: {
    passphrase: "monet",
  },
  port: 8092,
  port1: 8082,
  port2: 8666,
  wsproto: "monet-proctoring-protocol",
};

export const engine = {
  nginxConfigurationCreation: true,
  instanceStatisticsGathering: true,
  adminDBRegistryAndConfiguration: true,
  stopExistingGstreamer: true,
};

export const janus = {
  ws: process.env.JANUS_WS || "ws://localhost:8188/",
  apiSecret: "monet",
  admin: {
    hostname: process.env.JANUS_ADMIN_HOST || "127.0.0.1",
    port: Number(process.env.JANUS_ADMIN_PORT) || 7088,
    path: "/admin",
    secret: process.env.JANUS_ADMIN_SECRET || "monet",
  },
  recordings: recordingPath,
};

export const socket = {
  sessions: {},
};

export const resetLink = `http://${process.env.BASE_URL || "localhost"}:8092`;

const config = {
  db,
  data,
  web,
  engine,
  janus,
  socket,
  resetLink,
};

export default config;
