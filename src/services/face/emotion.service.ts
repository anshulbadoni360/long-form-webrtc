import path from "node:path";
import fs from "node:fs";
import log from "../logger/log";
import redis from "../redis/redis.service";
import { ConstantsModel } from "../../models/constants.model";
import { FaceReaderService } from "./facereader.service";
import { EngagementService } from "./engagement.service";
import { FaceDataService } from "./facedata.service";
import {
  FDConstants,
  MyMetric,
  FaceReaderResponse,
  RoomMetricData,
} from "../../types/face/face.types";
import { readBase64File } from "../../utils/normalize";

export class EmotionService {
  private watcher: fs.FSWatcher | null = null;
  private metricInterval: NodeJS.Timeout | null = null;
  private createdAt = new Date();
  private count = 0;
  private speaking = 0;
  private mic = 1;
  private webcamStatus = 1;
  private screenStatus = 0;
  private metricDurationMs = 5000;
  private uuid: string;
  private roomid: string;
  private imagePath = "";
  private constants: FDConstants = {
    speaking: 20,
    webcam: 10,
    screenShare: 10,
    engagementModifier: 0,
    arousalUpper: 1,
    arousalLower: 0,
    arousal: { min: 0, max: 100 },
    absYawUpper: 90,
    absYawLower: 0,
    yaw: { min: 0, max: 100 },
    absPitchUpper: 90,
    absPitchLower: 0,
    pitch: { min: 0, max: 100 },
    confUpper: 1,
    confLower: 0,
    confidence: { min: 0, max: 100 },
  };
  private roomMetricData: RoomMetricData[] = [];
  private myMetric: MyMetric = {
    speaking: false,
    NumberOfFaces: 0,
    engagement: 0,
    mood_score: 0,
    attention: 0,
    confusion: 0,
    arousal: 0,
    valence: 0,
    engagement_bucket: null,
    mood_bucket: null,
    segment: 0,
    createdAt: new Date(),
  };
  private timer: NodeJS.Timeout | null = null;

  constructor( uuid: string, roomid: string, watchDirPath: string, duration: number ) {
    this.uuid = uuid;
    this.roomid = roomid;
    this.metricDurationMs = duration;

    log.info(`Initializing EmotionService watcher for user ${uuid} in room ${roomid}.`);
    
    this.imagePath = path.join(watchDirPath, roomid, uuid, "images");
    this.watchDir();
    this.loadConstants();
  }

  async startTracking() {
    if (this.metricInterval) {
      log.error("Metric interval already in progress.");
      return;
    }
    try {
      const res = await redis.get(this.roomid);
      if (res) {
        const redisRes = JSON.parse(res);
        redisRes[this.uuid] = this.myMetric;
        await redis.set(this.roomid, JSON.stringify(redisRes));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      log.error(`Redis error in startTracking: ${message}`);
    }
    this.metricInterval = setInterval(() => {
      this.recordFallback();
      this.evaluateBatch();
    }, this.metricDurationMs);
  }

  set newWebcamStatus(_flag: number) {
    this.webcamStatus = _flag;
  }

  set newScreenStatus(_flag: number) {
    this.screenStatus = _flag;
  }

  set newSpeakingStatus(_flag: number) {
    this.speaking = _flag;
  }

  set newMicStatus(_flag: number) {
    this.mic = _flag;
  }

  setSpeakers = () => {
    this.speaking = 1;
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.speaking = 0;
    }, 10000);
  };

  private loadConstants() {
    ConstantsModel.findOne()
      .then((doc) => {
        if (doc) {
          this.constants = doc as any;
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Error fetching constants: ${message}`);
      });
  }

  watchDir = () => {
    const { imagePath } = this;
    if (!fs.existsSync(imagePath)) {
      fs.mkdirSync(imagePath, { recursive: true });
    }
    if (!this.watcher) {
      this.watcher = fs.watch(imagePath, (eventType, filename) => {
        if ((eventType === "change" || eventType === "rename") && filename) {
          const ext = filename.split(".").pop()?.toLowerCase();
          if (!ext || !["jpg", "jpeg", "png"].includes(ext)) return;

          const count = this.getCount(filename);
          if (this.count === count) return;

          this.count = count;
          this.createdAt = new Date();

          readBase64File(path.join(imagePath, filename)).then((bitmap) => {
            if (bitmap) {
              this.processImage(bitmap);
            } else {
              this.recordFallback();
            }
          });
        }
      });
    }
  };

  recordFallback = () => {
    const data = { count: this.count, roomid: this.roomid, uuid: this.uuid };
    const ts = new Date(this.createdAt.getTime() + 5000);
    this.roomMetricData.push({
      createdAt: ts,
      data,
      info: {
        json: { FaceAnalyzed: false },
        Engagement_01: {
          segment: this.count,
          NumberOfFaces: 0,
          engagement: 0,
          mood: 0,
          webcam: this.webcamStatus,
          screen: this.screenStatus,
          mic: this.mic,
          createdAt: ts,
        },
        FacialExpressions_01: {
          segment: this.count,
          happy: 0,
          sad: 0,
          angry: 0,
          disgusted: 0,
          surprised: 0,
          scared: 0,
          neutral: 0,
          arousal: 0,
          valence: 0,
          webcam: this.webcamStatus,
          screen: this.screenStatus,
          mic: this.mic,
          createdAt: ts,
        },
      },
    });
  };

  processImage = (bitmap: string) => {
    FaceReaderService.postImage(bitmap)
      .then((response) => {
        const data = {
          count: this.count,
          roomid: this.roomid,
          uuid: this.uuid,
        };
        if (response && response.FaceAnalyzed !== false && !response.Error) {
          this.handleFaceAnalysis(response, data);
        } else {
          this.recordFallback();
        }
      })
      .catch((error) => {
        log.error("FaceReader API processing failure:", error);
        this.recordFallback();
      });
  };

  // if done per second, this will only support 2.5 hours of video
  getCount = (fileName: string): number => {
    const numPart = fileName.substring(3, 7);
    return parseInt(numPart, 10) || 0;
  };

  handleFaceAnalysis = (
    faceData: FaceReaderResponse,
    data: { count: number; roomid: string; uuid: string },
  ) => {
    const ts = new Date(this.createdAt);
    const { count, roomid, uuid } = data;

    const scores = this.updateParticipantMetrics(faceData, count, ts);
    this.updateRedisLiveState(roomid, uuid);
    this.buildTelemetryPayload(faceData, scores, count, roomid, uuid, ts);
    this.evaluateBatch();
  };

  private updateParticipantMetrics(faceData: FaceReaderResponse, count: number, ts: Date) {
    const noOfFaces = faceData.NumberOfFaces || 0;
    const scores = EngagementService.calculateParticipantMetrics(
      faceData,
      this.constants,
      this.speaking,
      this.webcamStatus,
      this.screenStatus,
    );

    this.myMetric = {
      speaking: this.speaking === 1,
      NumberOfFaces: noOfFaces,
      engagement: scores.engagement,
      mood_score: scores.mood_score,
      attention: scores.attention,
      confusion: scores.confusion,
      arousal: scores.arousal,
      valence: scores.valence,
      engagement_bucket: null,
      mood_bucket: null,
      segment: count,
      createdAt: ts,
    };

    return scores;
  }

  private updateRedisLiveState(roomid: string, uuid: string) {
    redis
      .get(roomid)
      .then(async (res) => {
        if (res) {
          const redisRes = JSON.parse(res);
          redisRes[uuid] = this.myMetric;
          await redis.set(roomid, JSON.stringify(redisRes));
        }
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        log.error(`Redis set error: ${message}`);
      });
  }

  private buildTelemetryPayload(
    faceData: FaceReaderResponse,
    scores: ReturnType<typeof EngagementService.calculateParticipantMetrics>,
    count: number,
    roomid: string,
    uuid: string,
    ts: Date,
  ) {
    const noOfFaces = faceData.NumberOfFaces || 0;
    const payloadJson: any = { ...faceData };
    payloadJson.speaking = this.speaking;

    let happy = 0,
      sad = 0,
      angry = 0,
      disgusted = 0,
      surprised = 0,
      scared = 0,
      neutral = 0;

    if (
      faceData.FacialExpressions &&
      faceData.FacialExpressions.BasicEmotions
    ) {
      const basic = faceData.FacialExpressions.BasicEmotions;
      happy = basic.Happy;
      sad = basic.Sad;
      angry = basic.Angry;
      disgusted = basic.Disgusted;
      surprised = basic.Surprised;
      scared = basic.Scared;
      neutral = basic.Neutral;
    }

    this.roomMetricData.push({
      data: { uuid, roomid, count },
      info: {
        json: payloadJson,
        Engagement_01: {
          segment: count,
          NumberOfFaces: noOfFaces,
          engagement: scores.engagement,
          mood: scores.mood_score,
          webcam: this.webcamStatus,
          screen: this.screenStatus,
          mic: this.mic,
          createdAt: ts,
        },
        FacialExpressions_01: {
          segment: count,
          happy,
          sad,
          angry,
          disgusted,
          surprised,
          scared,
          neutral,
          arousal: scores.arousal,
          valence: scores.valence,
          webcam: this.webcamStatus,
          screen: this.screenStatus,
          mic: this.mic,
          createdAt: ts,
        },
      },
    });
  }

  evaluateBatch = () => {
    if (this.roomMetricData.length >= 60) {
      FaceDataService.saveBatch(this.roomMetricData.map(this.fdMapper));
      this.roomMetricData = [];
    }
  };

  endBatch = () => {
    if (this.roomMetricData.length > 0) {
      FaceDataService.saveBatch(this.roomMetricData.map(this.fdMapper));
      this.roomMetricData = [];
    }
  };

  cleanUp = () => {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    if (this.metricInterval) {
      clearInterval(this.metricInterval);
      this.metricInterval = null;
    }
    this.endBatch();
  };

  fdMapper = (object: RoomMetricData) => {
    return {
      uuid: object.data.uuid,
      roomid: object.data.roomid,
      segment: object.data.count,
      engagement: object.info.Engagement_01.engagement,
      webcam: object.info.Engagement_01.webcam,
      screen: object.info.Engagement_01.screen,
      mic: object.info.Engagement_01.mic,
      createdAt: object.info.Engagement_01.createdAt,
      mood: object.info.Engagement_01.mood,
      ...object.info.json,
    };
  };
}
