export interface BasicEmotions {
  Neutral: number;
  Happy: number;
  Sad: number;
  Angry: number;
  Surprised: number;
  Scared: number;
  Disgusted: number;
}

export interface FacialExpressions {
  DominantBasicEmotion: string | null;
  BasicEmotions: BasicEmotions;
  Valence: number;
  Arousal: number;
}

export interface Characteristics {
  Gender: string;
  Age: number;
  Glasses: string;
  Moustache: string;
  Beard: string;
}

export interface BoundingBox {
  Left: number | null;
  Top: number | null;
  Width: number | null;
  Height: number | null;
  PrimaryFace: boolean | null;
}

export interface ActionUnit {
  Name: string;
  Value: number;
}

export interface FaceReaderResponse {
  FaceAnalyzed: boolean;
  FacialExpressions?: FacialExpressions;
  Characteristics?: Characteristics;
  Confidence?: number;
  HeadOrientation?: [number, number, number] | null;
  BoundingBox?: BoundingBox[];
  NumberOfFaces?: number;
  ActionableEmotion?: string | null;
  ActionUnits?: ActionUnit[];
  Error?: string;
  StatusCode?: number;
  InvalidToken?: boolean;
}

export interface FDData {
  count: number;
  roomid: string;
  uuid: string;
}

export interface FDEngagement {
  segment: number;
  NumberOfFaces: number;
  engagement: number;
  mood: number;
  webcam: number;
  screen: number;
  mic: number;
  createdAt: Date;
}

export interface FDFacialExpressions {
  segment: number;
  happy: number;
  sad: number;
  angry: number;
  disgusted: number;
  surprised: number;
  scared: number;
  neutral: number;
  arousal: number;
  valence: number;
  webcam: number;
  screen: number;
  mic: number;
  createdAt: Date;
}

export interface FDInfo {
  json: FaceReaderResponse & { speaking?: number };
  Engagement_01: FDEngagement;
  FacialExpressions_01: FDFacialExpressions;
}

export interface RoomMetricData {
  createdAt?: Date;
  data: FDData;
  info: FDInfo;
}

export interface MyMetric {
  speaking: boolean;
  NumberOfFaces: number;
  engagement: number;
  mood_score: number;
  attention: number;
  confusion: number;
  arousal: number;
  valence: number;
  engagement_bucket: string | null;
  mood_bucket: string | null;
  segment: number;
  createdAt: Date;
}

export interface FDConstants {
  speaking: number;
  webcam: number;
  screenShare: number;
  engagementModifier: number;
  arousalUpper: number;
  arousalLower: number;
  arousal: { min: number; max: number };
  absYawUpper: number;
  absYawLower: number;
  yaw: { min: number; max: number };
  absPitchUpper: number;
  absPitchLower: number;
  pitch: { min: number; max: number };
  confUpper: number;
  confLower: number;
  confidence: { min: number; max: number };
}
