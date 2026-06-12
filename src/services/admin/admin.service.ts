import jwt from "jsonwebtoken";
import path from "node:path";
import fs from "node:fs/promises";
import metricsService from "../instance/metrics.service";
import { monetRooms } from "../room/room.service";
import log from "../logger/log";
import { AppError } from "../errors/app.error";

const JWT_SECRET = process.env.JWT_SECRET || "slave-secret-key-12345";

class AdminService {
  public login(username: string, password: string): string {
    if (username === "anshulbadoni" && password === "anshulbadoni") {
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: "1d" });
      return token;
    }
    throw new AppError(400, "Invalid username or password");
  }

  public getSettings() {
    return {
      cpuThreshold: metricsService.cpuThreshold,
      ramThreshold: metricsService.ramThreshold,
      publicIp: metricsService.publicIp,
      stats: metricsService.state,
    };
  }

  public updateSettings(cpuThreshold?: number, ramThreshold?: number, publicIp?: string) {
    if (typeof cpuThreshold === "number") {
      metricsService.cpuThreshold = cpuThreshold;
    }
    if (typeof ramThreshold === "number") {
      metricsService.ramThreshold = ramThreshold;
    }
    if (typeof publicIp === "string" && publicIp.trim() !== "") {
      metricsService.publicIp = publicIp.trim();
    }

    return {
      cpuThreshold: metricsService.cpuThreshold,
      ramThreshold: metricsService.ramThreshold,
      publicIp: metricsService.publicIp,
    };
  }

  public getRooms() {
    return Object.values(monetRooms).map((room: any) => ({
      roomid: room.roomid,
      active: room.State.active,
      participants: room.noActiveParticipants,
      realTimeScores: room.realTimeScores,
    }));
  }

  public async killRoom(roomid: string): Promise<void> {
    const room = monetRooms[roomid];
    if (!room) {
      throw new AppError(404, `Room ${roomid} not found or not active.`);
    }
    try {
      log.info(`[Admin] Force killing room: ${roomid}`);
      await room.cleanUp();
    } catch (err: any) {
      log.error(`[Admin] Failed to kill room ${roomid}: ${err.message}`);
      throw new AppError(500, `Failed to kill room: ${err.message}`);
    }
  }

  public async getLogs(): Promise<any[]> {
    try {
      let logFilePath = path.resolve(__dirname, "../../../logs/app.log");
      if (process.env.LOG_FILE_PATH) {
        logFilePath = path.resolve(process.env.LOG_FILE_PATH);
      }

      let logData = "";
      try {
        logData = await fs.readFile(logFilePath, "utf8");
      } catch (err: any) {
        log.error(`[Admin] Error reading log file: ${err.message}`);
      }

      const lines = logData
        .split("\n")
        .filter((line) => line.trim().length > 0);

      const parsedLogs = lines.map((line) => {
        const regex = /^\[(.*?)\]\s+(.*)$/;
        const match = line.match(regex);
        if (match) {
          const timestamp = match[1];
          let remaining = match[2];

          let level = "info";
          if (remaining.startsWith("WARN:")) {
            level = "warning";
            remaining = remaining.substring(5).trim();
          } else if (remaining.startsWith("ERROR:")) {
            level = "error";
            remaining = remaining.substring(6).trim();
          }

          let source = "slave";
          if (
            remaining.includes("[MonetRoom]") ||
            remaining.includes("[RoomParticipants]")
          ) {
            source = "room-manager";
          } else if (
            remaining.startsWith("[Admin]") ||
            remaining.startsWith("[Presence]")
          ) {
            source = "admin";
          } else if (
            remaining.includes("Janus") ||
            remaining.includes("janus")
          ) {
            source = "janus";
          } else {
            source = "system";
          }

          // Format time as HH:mm:ss
          let timeFormatted = timestamp;
          try {
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
              timeFormatted = date.toTimeString().split(" ")[0]; // HH:mm:ss
            }
          } catch (error: any) {}

          return {
            time: timeFormatted,
            level,
            event: remaining,
            source,
          };
        }

        return {
          time: new Date().toTimeString().split(" ")[0],
          level: "info",
          event: line,
          source: "system",
        };
      });

      return parsedLogs.reverse().slice(0, 100);
    } catch (err: any) {
      log.error(`[Admin] Failed to retrieve logs: ${err.message}`);
      throw new AppError(500, err.message || "Internal server error");
    }
  }
}

export default new AdminService();
