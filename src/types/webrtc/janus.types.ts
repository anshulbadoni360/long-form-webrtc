export interface JanusConfig {
  janus: {
    ws: string;
    recordings: string;
    apiSecret: string | null;
    roomSecret?: string;
    admin: {
      hostname: string;
      port: number;
      path: string;
      secret: string;
    };
    session?: number;
    state?: "disconnected" | "connecting" | "connected";
  };
}

export interface JanusSession {
  uuid: string;
  socketId: string;
  notify: (event: string, payload: any) => void;
  handles: Record<string, number>;
  newsession: Record<string, any>;
  candidates: Record<string, any[]>;
}

export interface JanusHandle {
  uuid: string;
  stream?: string;
  feed?: string;
  room: number;
  when?: string | number;
  publisher?: number;
}

export interface RoomDetails {
  roomid?: string | number;
  room?: string | number;
  [key: string]: any;
}

export interface PublishDetails {
  jsep: any;
  user: {
    uuid: string;
    janus: {
      roomid: string;
    };
  };
  stream: string;
  when: string | number;
}

export interface SubscribeDetails {
  uuid: string;
  feed: string;
  stream: string;
  room: string | number;
  jsep?: any;
  when?: string;
  exam?: any;
}
