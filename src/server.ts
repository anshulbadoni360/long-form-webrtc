import "dotenv/config";
import express, { Express, Request, Response } from "express";
import cors from "cors";
import { createServer } from "node:http";
import { Server } from "socket.io";
import mongoose from "mongoose";

import connectDatabase from "./connection/database";
import profile from "./routes/user/profile/user.profile.route";
import room from "./routes/room/room.routes";
import admin from "./routes/admin/admin.routes";
import log from "./services/logger/log";
import { initializeSockets } from "./sockets";
import janusService from "./services/webrtc/janus.service";
import janusConfig from "./config";
import { ResponseDto } from "./services/DTO";

// we don't need metrics service here as we don't have autoscaling here
// import metricsService from "./services/instance/metrics.service";

import { resolvePublicIp, formatIpToRoute } from "./utils/normalize";

const app: Express = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 8092;

app.use(express.json());
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);

app.use(room);
app.use(profile);
app.use(admin);

// Asynchronously bootstrap server components (IP -> Database -> Websocket Server)
const bootstrapServer = async () => {
  try {
    const ip = await resolvePublicIp();
    const formattedRoute = formatIpToRoute(ip);
    const wsPath = `/slave/${formattedRoute}/sock/`;

    log.info(`[Bootstrap] Socket.io server path resolved to: ${wsPath}`);

    const io = new Server(httpServer, {
      path: wsPath,
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"],
      },
    });

    initializeSockets(io);
    connectDatabase();

    janusService.initialize(janusConfig);
    janusService.connect((err) => {
      if (err) {
        log.error("Failed to connect to Janus WebSocket gateway:", err);
        process.exit(1);
      } else {
        log.info("Janus Gateway client connected successfully.");
      }
    });

    // metricsService.startMonitoring(ip);

    app.get("/healthcheck", (req: Request, res: Response) => {
      res.status(200).json(ResponseDto.ok("Server is running"));
    });

    app.use((req: Request, res: Response) => {
      res.status(404).send(ResponseDto.fail("Endpoint not found."));
    });

    httpServer.listen(PORT, () => {
      log.info(`Slave server running successfully on port ${PORT}`);
    });
  } catch (error: any) {
    log.error(
      "Critical error during server bootstrap:",
      error.message || error,
    );
    process.exit(1);
  }
};

bootstrapServer();

// graceful shutdown
const gracefulShutdown = async () => {
  log.info("Shutting down gracefully...");

  // metricsService.stopMonitoring();
  janusService.disconnect();

  await mongoose.disconnect();
  httpServer.close(() => {
    log.info("HTTP server closed.");
    process.exit(0);
  });
  // Force exit if graceful shutdown takes too long
  setTimeout(() => process.exit(1), 10000);
};

// Handle termination signals
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);

export default app;
