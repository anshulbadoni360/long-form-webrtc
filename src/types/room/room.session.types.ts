export interface RoomSettings {
  limit: number;
  realTimeScores: number;
}

export interface RoomParticipantDetail {
  ui_id: string;
  UserId: string;
  name: string | null;
}

export interface RoomSessionState {
  interval: "stopped" | "running";
  active: boolean;
}

export enum MeetingStatus {
  Completed = "completed",
}

export type RoomUpdate = Partial<{
  end: {
    dateTime: Date;
    timeZone: string;
  };
  alive: number;
  meeting: MeetingStatus | string;
}>;

export interface RoomEvents {
  "broadcast-room-metrics": [
    {
      roomid: string;
      data: unknown;
    }
  ];
  "room-destroyed": [];
}

