import { Socket, Server } from "socket.io";
import registerInteraction from "./room.interaction";
import registerProctoring from "./room.proctoring";
import registerModeration from "./room.moderation";
import log from "../../../services/logger/log";

export default (io: Server, socket: Socket) => {
  // Local wrapper helper to automatically inject validated roomid into incoming payloads
  const on = (event: string, handler: (data: any) => void) => {
    socket.on(event, (data) => {
      const payload = (data && typeof data === "object") ? data : {};
      
      if (!payload.roomid && socket.handshake.query.roomid) {
        payload.roomid = socket.handshake.query.roomid;
      }
      else if (!payload.roomid) {
        log.warn(`[${event}] Missing roomid`);
        return;
      }
      
      handler(payload);
    });
  };

  // Mount split event listeners sharing the same local "on" injection helper
  registerInteraction(on, socket);
  registerProctoring(on, socket);
  registerModeration(on, socket);
};
