import log from "../logger/log";
import {
  ProcessingResult,
  TranscriptResponse,
  SummaryResponse,
  PostProcessingResponse,
} from "../../types/room/post.processing.types";
import { AppError } from "../errors/app.error";

export class PostProcessingService {
  private static readonly baseUrl = process.env.POST_URL || "";
  private static readonly enablePostProcessing = process.env.ENABLE_POST_PROCESSING !== "false";
  private static readonly serviceNames = [
    "Transcription",
    "Summary",
    "Mosaic",
  ] as const;

  /**
   * Triggers transcription, summary, and mosaic generation when a room ends.
   */
  public static async triggerPostProcessing(
    roomid: string,
    email?: string,
  ): Promise<PostProcessingResponse> {
    if (!this.enablePostProcessing) {
      log.info(`[PostProcessing] Auto post-processing is DISABLED in .env`);
      return { status: "disabled", message: "Post processing turned off in environment" };
    }

    if (!roomid) {
      log.error("[PostProcessing] ❌ roomid is required");
      return { status: "failed", message: "roomid is required" };
    }

    if (!this.baseUrl) {
      log.error("[PostProcessing] POST_URL is not defined in .env");
      return { status: "failed", message: "POST_URL is not defined in environment" };
    }

    log.info(`[PostProcessing] Starting for room: ${roomid}, email: ${email || "N/A"}`);

    const tasks = [
      this.triggerTranscription(roomid),
      this.triggerSummary(roomid, email),
      this.triggerMosaic(roomid),
    ] as const;

    const results = await Promise.allSettled(tasks);

    results.forEach((result, index) => {
      if (result.status === "fulfilled") {
        log.info(`[PostProcessing] ${this.serviceNames[index]} Success`);
      } else {
        log.error(`[PostProcessing] ❌ ${this.serviceNames[index]} Failed: ${result.reason?.message}`);
      }
    });

    log.info(`[PostProcessing] Finished for room ${roomid}`);
    return {
      status: "success",
      results: results as PromiseSettledResult<ProcessingResult>[],
    };
  }

  private static async triggerTranscription(roomid: string): Promise<ProcessingResult> {
    const getUrl = `${this.baseUrl}/transcribe/${roomid}`;

    try {
      const response = await fetch(getUrl);
      if (response.ok) {
        const data = (await response.json()) as TranscriptResponse;
        if (data && data.transcriptEntries && data.transcriptEntries.length > 0) {
          return { status: "completed", data };
        }
      } else if (response.status !== 404) {
        throw new AppError(response.status, `API status ${response.status}`);
      }

      log.info(`[Transcription] Transcript not found or empty for room ${roomid}. Queueing new transcription...`);

      const postUrl = `${this.baseUrl}/transcribe/?roomid=${encodeURIComponent(roomid)}`;
      const postResponse = await fetch(postUrl, { method: "POST" });
      if (!postResponse.ok) {
        throw new AppError(postResponse.status, `HTTP ${postResponse.status}`);
      }

      return { status: "processing", message: "Transcription job queued" };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[Transcription] Error for room ${roomid}: ${message}`);
      throw error;
    }
  }

  private static async triggerSummary(roomid: string, email?: string): Promise<ProcessingResult> {
    const getUrl = `${this.baseUrl}/summary/${roomid}`;

    try {
      const response = await fetch(getUrl);
      if (response.ok) {
        const data = (await response.json()) as SummaryResponse;
        if (data && data.summary) {
          return { status: "completed", data };
        }
      } else if (response.status !== 404) {
        throw new AppError(response.status, `API status ${response.status}`);
      }

      log.info(`[Summary] Summary not found or empty for room ${roomid}. Queueing new summary...`);

      const postUrl = `${this.baseUrl}/summary/enqueue/${roomid}`;
      const postResponse = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!postResponse.ok) {
        throw new AppError(postResponse.status, `HTTP ${postResponse.status}`);
      }

      return { status: "processing", message: "Summary job queued" };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[Summary] Error for room ${roomid}: ${message}`);
      throw error;
    }
  }

  private static async triggerMosaic(roomid: string): Promise<ProcessingResult> {
    const url = `${this.baseUrl}/mosaic/create-mosaic`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomid }),
      });
      if (!response.ok) {
        throw new AppError(response.status, `HTTP ${response.status}`);
      }
      const data = response.status === 204 ? {} : await response.json();
      return { status: "processing", data };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`[Mosaic] Error for room ${roomid}: ${message}`);
      throw error;
    }
  }
}
