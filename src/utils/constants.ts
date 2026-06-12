export const ROLES = {
  TEACHER: "teacher" as const,
  COHOST: "cohost" as const,
  OBSERVER: "observer" as const,
  STUDENT: "student" as const,
  MANAGER: "manager" as const,
};

export const EVENTS = {
  CREATE_USER: "create-user",
  NEW_USER: "new-user",
  PRIVATE_MESSAGE: "private-message",
  PRIVATE_SEND_MESSAGE: "private-send-message",
  MEETING_INITIATED: "meeting-initiated",
  DISCONNECT: "disconnect",
  RE_MAP: "re-map",
  ERROR: "error",
  SUCCESS: "success",
  ROOM_LIST: "room-list",
  OBSERVER_LIST: "observer-list",
  WEBRTC: "webrtc",
  PUBLISH: "publish",
  RE_NEGOTIATE: "re-negotiate",
  TRICKLE: "trickle",
  ICE_REQUEST: "ice-request",
  CONNECTED: "connected",
};
