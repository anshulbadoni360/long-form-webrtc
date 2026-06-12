import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import log from "../logger/log";
import kill from "tree-kill";
import { GStreamerConfig } from "../../types/socket/webrtc.types";

export class GStreamerService {
  private process: ChildProcess | null = null;
  private config: GStreamerConfig;

  constructor(config: GStreamerConfig) {
    if (!config) {
      throw new Error("Invalid configuration");
    }
    const { port, folder } = config;

    if (!port || isNaN(port) || port < 1024 || port > 65535) {
      throw new Error("Invalid port");
    }
    if (!folder) {
      throw new Error("Invalid target folder");
    }

    this.config = config;
    this.start();
  }

  private start() {
    const { port, folder, realTimeScores = 10, onStarted, onDone } = this.config;

    // Path to the pipeline script: goes up to src, then to root, then to gstreamer/video2img.sh
    const rtpRecipient = path.join(__dirname, "..", "..", "..", "gstreamer", "video2img.sh");
    log.info(`Preparing GStreamer pipeline on port ${port} saving to ${folder}`);

    try {
      this.process = spawn(rtpRecipient, [
        port.toString(),
        realTimeScores.toString(),
        folder,
      ]);

      this.process.stdout?.on("data", (data: Buffer) => {
        log.info(`GStreamer [Port ${port}]: ${data.toString("utf8").trim()}`);
      });

      this.process.stderr?.on("data", (data: Buffer) => {
        log.info(`GStreamer StdErr [Port ${port}]: ${data.toString("utf8").trim()}`);
      });

      this.process.on("close", (code) => {
        log.warn(`GStreamer pipeline process for port ${port} exited with code: ${code}`);
        if (onDone) {
          onDone(code);
        }
      });

      if (onStarted) {
        onStarted();
      }
    } catch (err: unknown) {
      const errorObj = err instanceof Error ? err : new Error(String(err));
      log.error(`Failed to spawn GStreamer pipeline on port ${port}: ${errorObj.message}`);
      if (this.config.onError) {
        this.config.onError(errorObj);
      }
    }
  }

  public stop(callback?: (err?: any) => void): void {
    if (!this.process || this.process.pid === undefined) {
      log.warn("GStreamer process is not running or already stopped.");
      if (callback) callback();
      return;
    }

    log.info(`Stopping GStreamer pipeline process with PID: ${this.process.pid}`);
    kill(this.process.pid, "SIGINT", (err: any) => {
      if (err) {
        log.error(`Error killing GStreamer process ${this.process?.pid}:`, err);
        if (callback) callback(err);
      } else {
        log.info(`GStreamer pipeline process ${this.process?.pid} successfully terminated.`);
        if (callback) callback();
      }
    });
  }
}
