import { createClient } from "redis";
import log from "../logger/log";

// Initialize the strongly-typed Redis client
const redis = createClient({
  url: process.env.REDIS_URL || process.env.REDIS_URI || "redis://localhost:6379",
});

redis.on("connect", () => {
  log.info("Redis client connecting...");
});

redis.on("ready", () => {
  log.info("Redis client ready to use.");
});

redis.on("error", (err: any) => {
  log.error("Redis Client Error:", err);
});

redis.on("end", () => {
  log.warn("Redis connection closed.");
});

redis.on("reconnecting", () => {
  log.warn("Redis client reconnecting...");
});

// Automatically connect to Redis
redis.connect().catch((err: any) => {
  log.error("Failed to connect to Redis on startup:", err as Error);
});

export default redis;
