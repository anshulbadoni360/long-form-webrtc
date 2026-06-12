export type MeetingStatus = "started" | "ended" | "paused";

export type RoomUpdate = Partial<{
  end: {
    dateTime: Date;
    timeZone: string;
  };
  alive: number;
  meeting: MeetingStatus | string;
}>;

interface RoomEvents {
  "broadcast-room-metrics": [
    {
      roomid: string;
      data: unknown;
    },
  ];
  "room-destroyed": [];
}
