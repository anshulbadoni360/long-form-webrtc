import fs from "node:fs";
import path from "node:path";
import log from "../../logger/log";

export class RecordingManager {
  private baseRecordingsDir: string;

  constructor(baseRecordingsDir: string) {
    if (!baseRecordingsDir) {
      throw new Error("Base recordings directory must be configured");
    }
    this.baseRecordingsDir = baseRecordingsDir;
    this.ensureDirExists(this.baseRecordingsDir);
  }

  /**
   * Helper to ensure a directory exists recursively.
   */
  private ensureDirExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      try {
        fs.mkdirSync(dirPath, { recursive: true });
        log.info(`[RecordingManager] Created directory: ${dirPath}`);
      } catch (err: any) {
        log.error(`[RecordingManager] Failed to create directory ${dirPath}: ${err.message}`);
        throw err;
      }
    }
  }

  /**
   * Ensures the session recordings folder exists and returns its path.
   */
  public getSessionFolder(room: string | number, uuid: string): string {
    const sessionPath = path.join(this.baseRecordingsDir, room.toString(), uuid);
    this.ensureDirExists(sessionPath);
    return sessionPath;
  }

  /**
   * Ensures the legacy join/subscription recordings folder exists.
   */
  public getTimedSessionFolder(room: string | number, uuid: string, when: string | number): string {
    const timedPath = path.join(this.baseRecordingsDir, room.toString(), uuid, when.toString());
    this.ensureDirExists(timedPath);
    return timedPath;
  }

  /**
   * Ensures the GStreamer images folder exists.
   */
  public getImageFolder(room: string | number, uuid: string): string {
    const imagesPath = path.join(this.baseRecordingsDir, room.toString(), uuid, "images");
    this.ensureDirExists(imagesPath);
    return imagesPath;
  }

  /**
   * Returns path for specific file prefix.
   */
  public getRecordingFilePrefix(uuid: string, stream: string): string {
    // Note: Use forward slashes or standard separators depending on Janus' expectations.
    // Since Janus is often running in a Docker container or Linux environment, path.join's backslashes on Windows can cause issues.
    // Let's format the recording file path with forward slashes explicitly.
    const normalizedBase = this.baseRecordingsDir.replace(/\\/g, "/");
    return `${normalizedBase}/${uuid}-${stream}`;
  }
}
