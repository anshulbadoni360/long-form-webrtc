import mongoose from "mongoose";
import log from "../services/logger/log";

export const connectDatabase = async (): Promise<void> => {
  const MONGO_URI =
    process.env.MONGO_URI?.trim() || "mongodb://localhost:27017/monet_live";

  try {
    await mongoose.connect(MONGO_URI);

    log.info("Connected to MongoDB successfully.");

    mongoose.connection.on("disconnected", () => {
      log.warn("MongoDB disconnected.");
    });

    mongoose.connection.on("reconnected", () => {
      log.info("MongoDB reconnected.");
    });

    mongoose.connection.on("error", (err) => {
      log.error("MongoDB error:", err);
    });
  } catch (error: any) {
    log.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }
};

export default connectDatabase;
