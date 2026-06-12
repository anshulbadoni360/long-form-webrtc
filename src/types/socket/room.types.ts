export interface SocketEventConfig {
  event: string;
  handler: string;
  roles?: string[];
}

export interface RoomChatPayload {
  roomid: string;
  msg: string;
  [key: string]: any;
}

export interface RaiseHandPayload {
  roomid: string;
  [key: string]: any;
}

export interface AdminActionPayload {
  roomid: string;
  action: string;
  targetUserId?: string;
  [key: string]: any;
}

export interface FaceDataPayload {
  roomid: string;
  metrics: {
    happy: number;
    sad: number;
    neutral: number;
    arousal: number;
    valence: number;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface DialerDataPayload {
  roomid: string;
  score: number;
  [key: string]: any;
}


export interface ActiveParticipant {
  socketId: string;
  userId: string; // uuid
  name: string;
  roomid: string;
  role: "teacher" | "cohost" | "observer" | "student" | "manager";
  webcam: boolean;
  screen: boolean;
  audio: boolean;
  video: boolean;
  raiseHand: boolean;
  groupId: string | null;
}
