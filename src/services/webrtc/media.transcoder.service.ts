import { spawn } from "node:child_process";
import path from "node:path";
import log from "../logger/log";

export class MediaTranscoderService {
  /**
   * Per-user dedup lock: prevents double-triggering when both the Janus hangup
   * event and the socket disconnect grace timer fire close together for the same user.
   */
  private static readonly pending: Set<string> = new Set();

  /**
   * Triggers the video generation process for a specific user in a room.
   * Idempotent within a short dedup window — safe to call from multiple code paths.
   * @param uuid - The UUID of the user.
   * @param roomid - The ID of the room.
   */
  public static triggerVideoGeneration(uuid: string, roomid: string): void {
    if (MediaTranscoderService.pending.has(uuid)) {
      log.info(
        `[MediaTranscoder] Video generation already scheduled for ${uuid}. Skipping duplicate.`,
      );
      return;
    }

    MediaTranscoderService.pending.add(uuid);
    const converter = path.join(
      __dirname,
      "..",
      "..",
      "..",
      "shell",
      "process_media.sh",
    );
    log.info(
      `[MediaTranscoder] Scheduling video generation for user ${uuid} in room ${roomid}`,
    );

    setTimeout(() => {
      MediaTranscoderService.pending.delete(uuid);
      try {
        const child = spawn("bash", [converter, uuid, roomid], {
          stdio: ["ignore", "inherit", "inherit"],
        });

        child.on("error", (err: Error) => {
          log.error(
            `[MediaTranscoder] Failed to start video generation for ${uuid}:`,
            err,
          );
        });

        child.on("exit", (code: number | null) => {
          if (code !== 0) {
            log.warn(
              `[MediaTranscoder] Video generation for ${uuid} exited with code: ${code}`,
            );
          } else {
            log.info(
              `[MediaTranscoder] Video generation completed successfully for user ${uuid}`,
            );
          }
        });
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        log.error(
          `[MediaTranscoder] Error spawning process_media.sh for user ${uuid}: ${message}`,
        );
      }
    }, 2000);
  }
}
