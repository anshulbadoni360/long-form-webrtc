export interface Jsep {
  type: string;
  sdp: string;
}

export interface WebRtcPublishPayload {
  stream: "webcam" | "screen" | "audio";
  jsep: Jsep;
  [key: string]: any;
}

export interface WebRtcReNegotiatePayload {
  stream: "webcam" | "screen" | "audio";
  jsep: Jsep;
  [key: string]: any;
}

export interface WebRtcTricklePayload {
  stream: "webcam" | "screen" | "audio";
  candidate: {
    candidate: string;
    sdpMid: string;
    sdpMLineIndex: number;
    usernameFragment?: string;
  } | null;
  [key: string]: any;
}

// Beautiful swappable gateway interface
export interface IMediaGatewayProvider {
  connect(callback: (err?: any) => void): void;
  isReady(): boolean;
  getState(): string;
  publish(details: any, callback: (err: any, result?: any) => void): void;
  publishAudio(details: any, callback: (err: any, result?: any) => void): void;
  reNegotiate(details: any, callback: (err: any, result?: any) => void): void;
  trickle(details: { uuid: string; stream: string; candidate: any }): void;
  createRoomByID(details: { roomid: string | number }, callback: (err: any, result?: any) => void): void;
  removeSession(details: { uuid: string }): void;
}

export interface GStreamerConfig {
  port: number;
  folder: string;
  realTimeScores?: number;
  onStarted?: () => void;
  onError?: (err: any) => void;
  onDone?: (code: number | null) => void;
}
