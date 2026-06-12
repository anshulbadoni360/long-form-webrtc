import log from "../logger/log";
import { TokenModel } from "../../models/tokens.model";
import { FaceReaderResponse } from "../../types/face/face.types";

export class FaceReaderService {
  private static cachedToken: string | null = null;
  private static tokenFetchedAt: number | null = null;
  private static readonly TOKEN_MAX_AGE_MS = 23 * 60 * 60 * 1000; // 23 hours

  private static async fetchNewToken(): Promise<string> {
    try {
      const response = await fetch("https://metrics.monetanalytics.com/services/facereader/authenticate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: process.env.FACEREADER_USERNAME || "monet1",
          password: process.env.FACEREADER_PASSWORD || "k6684WnnD$wR",
        }),
      });

      if (!response.ok) {
        log.error(`FaceReader Auth Service Error: Status ${response.status}`);
        throw new Error(`Token auth status ${response.status}`);
      }

      const parsed = (await response.json()) as Record<string, any>;
      const token = (parsed.token || parsed.Token || parsed.access_token || parsed.accessToken) as string | undefined;
      if (!token) {
        throw new Error("No token field in response");
      }

      this.cachedToken = token;
      this.tokenFetchedAt = Date.now();
      
      TokenModel.create({ token }).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Failed to save token to database: ${message}`);
      });

      return token;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      log.error(`Token fetch connection error: ${message}`);
      throw e;
    }
  }

  public static async getFaceReaderToken(): Promise<string> {
    if (this.cachedToken && this.tokenFetchedAt && (Date.now() - this.tokenFetchedAt) < this.TOKEN_MAX_AGE_MS) {
      return this.cachedToken;
    }

    try {
      const dbRecord = await TokenModel.findOne().sort({ createdAt: -1 });
      if (dbRecord && dbRecord.createdAt && (Date.now() - dbRecord.createdAt.getTime()) < this.TOKEN_MAX_AGE_MS) {
        this.cachedToken = dbRecord.token;
        this.tokenFetchedAt = dbRecord.createdAt.getTime();
        return dbRecord.token;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`Error reading token from database: ${message}`);
    }

    return await this.fetchNewToken();
  }

  public static async postImage(base64: string): Promise<FaceReaderResponse> {
    try {
      const token = await this.getFaceReaderToken();
      const cleanBase64 = base64.includes(",") ? base64.split(",")[1] : base64;

      const response = await fetch("https://metrics.monetanalytics.com/FaceReaderPOSTv8/api/facereaderservice/PostImage", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          myImage: cleanBase64,
          data: "BASIC",
          sessionInfo: "extras",
        }),
      });

      if (!response.ok) {
        return { FaceAnalyzed: false, Error: `API status ${response.status}` };
      }

      const bodyText = await response.text();
      if (bodyText.includes("{FaceAnalyzed:false, Invalid Token! }")) {
        this.cachedToken = null;
        this.tokenFetchedAt = null;
        return { FaceAnalyzed: false, InvalidToken: true };
      }

      try {
        return JSON.parse(bodyText);
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return { FaceAnalyzed: false, Error: message };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { FaceAnalyzed: false, Error: message };
    }
  }
}
