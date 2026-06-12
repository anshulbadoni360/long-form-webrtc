import { EventEmitter } from "node:events";
import { RedisClientType } from "redis";
import { Room } from "../../models/rooms.model";
import log from "../logger/log";
import { RoomEvents } from "../../types/room/room.session.types";
import { RoomUpdate } from "../../types/room/monet.room.types";

export const DEFAULT_ROOM_ID = "1234";
export const TIMEZONE_KOLKATA = "Asia/Kolkata";

export enum MeetingStatus {
  Completed = "completed",
}

export class MonetRoom extends EventEmitter<RoomEvents> {
  public roomid: string;

  private creatorId: string;
  private creationSource: string;
  private settings: { limit?: number | null; realTimeScores: number };
  private activeParticipants = new Set<string>();
  private interval: NodeJS.Timeout | null = null;
  private redis: RedisClientType | null = null;
  public active = true;
  private metricInFlight = false;
  private cleanupTimeout: NodeJS.Timeout | null = null;

  constructor(room: {
    roomid: string;
    source: string;
    creator_ID: string;
    scheduled: boolean;
    settings: { limit?: number | null; realTimeScores: number };
  }) {
    super();
    this.roomid = room.roomid;
    this.creationSource = room.source;
    this.creatorId = room.creator_ID;
    this.settings = room.settings;
  }

  private get redisKey(): string {
    return String(this.roomid);
  }


  public addActiveParticipant(userId: string): void {
    this.activeParticipants.add(userId);
    if (this.cleanupTimeout) {
      log.info(`[MonetRoom] Active participant count increased in room ${this.roomid}. Cancelling pending cleanup timer.`);
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
      this.startFaceDetection();
    }
  }

  public removeActiveParticipant(userId: string): void {
    this.activeParticipants.delete(userId);
    if (this.activeParticipants.size === 0) {
      this.killInterval();
      if (!this.cleanupTimeout) {
        log.info(`[MonetRoom] Room ${this.roomid} has 0 active participants. Starting 1-minute cleanup timer.`);
        this.cleanupTimeout = setTimeout(async () => {
          log.info(`[MonetRoom] 1-minute cleanup timer expired for room ${this.roomid}. Deleting room.`);
          this.cleanupTimeout = null;
          await this.cleanUp();
        }, 60000);
      }
    }
  }

  public initializeRedis(red: RedisClientType): void {
    this.redis = red;
    if (this.redis) {
      // Use NX option to avoid overwriting existing data if metrics are already present
      this.redis
        .set(this.redisKey, JSON.stringify({}), { NX: true })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : String(err);
          log.error(`[MonetRoom] Failed to init room in redis: ${message}`);
        });
    }
  }

  get realTimeScores() {
    return this.settings.realTimeScores;
  }

  get noActiveParticipants() {
    return this.activeParticipants.size;
  }

  get State() {
    return {
      interval: (this.interval ? "running" : "stopped") as
        | "running"
        | "stopped",
      active: this.active,
    };
  }

  public async persist(keys: RoomUpdate) {
    if (!keys) {
      log.error("No keys provided for persist collection");
      return;
    }
    try {
      const updatedRoom = await Room.findOneAndUpdate(
        { roomid: this.roomid },
        { $set: keys },
        { returnDocument: 'after' },
      ).lean();

      if (updatedRoom) {
        this.settings = {
          ...updatedRoom.settings,
          realTimeScores: this.settings.realTimeScores,
        };
      } else {
        log.error(`No room found with the ID: ${this.roomid}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`[MonetRoom] Database persist failed: ${message}`);
    }
  }

  public startFaceDetection() {
    if (this.interval) {
      log.warn(
        `Face detection interval already running for room ${this.roomid}`,
      );
      return;
    }

    if (this.activeParticipants.size > 0) {
      const intervalSeconds = Math.max(
        Number(this.settings.realTimeScores) || 5,
        1,
      );
      const checkIntervalMs = intervalSeconds * 1000;

      this.interval = setInterval(() => {
        if (this.redis) {
          this.sendMetric();
        }
      }, checkIntervalMs);
    }
  }

  public killInterval() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
      log.info(
        `[MonetRoom] The interval has been killed successfully for room ${this.roomid}.`,
      );
    }
  }

  private async sendMetric() {
    if (!this.redis || this.metricInFlight) return;
    this.metricInFlight = true;

    try {
      const res = await this.redis.get(this.redisKey);
      if (res) {
        const redRes = JSON.parse(res);
        this.emit("broadcast-room-metrics", {
          roomid: this.roomid,
          data: redRes,
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(
        `there is an issue getting metrics for room ${this.roomid}. Deleting malformed Redis key: ${message}`,
      );
      await this.redis.del(this.redisKey).catch(() => {});
    } finally {
      this.metricInFlight = false;
    }
  }

  public async cleanUp() {
    log.info(`Cleaning up room : ${this.roomid}`);
    this.killInterval();
    this.active = false;

    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout);
      this.cleanupTimeout = null;
    }

    if (this.roomid === DEFAULT_ROOM_ID) {
      log.info("Returning as the room is default 1234...");
      return;
    }

    const endDate = new Date();
    const keys = {
      end: {
        dateTime: endDate,
        timeZone: TIMEZONE_KOLKATA,
      },
      alive: 2,
      meeting: MeetingStatus.Completed,
    };
    await this.persist(keys);

    try {
      const janusService = (await import("../webrtc/janus.service")).default;
      await janusService.destroyRoom({ room: this.roomid });
      log.info(`[MonetRoom] Successfully destroyed room in Janus during cleanup: ${this.roomid}`);
    } catch (err: any) {
      log.error(`[MonetRoom] Failed to destroy room in Janus during cleanup: ${err.message || err}`);
    }

    log.info(`[${this.roomid}] Room session cleanup completed`);
    this.emit("room-destroyed");
    this.removeAllListeners();
  }
}
export default MonetRoom;