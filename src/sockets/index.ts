import { Server, Socket } from "socket.io";
import roleSocket from "../services/socket/socket.role.service";
import roomParticipantsService from "../services/socket/room.participants.service";
import registerRoomSockets from "./sock/room/room.socket";
import registerUserSockets from "./sock/user/user.socket";
import registerWebRtcSockets from "./rtc/webrtc.socket";
import log from "../services/logger/log";
import { monetRooms } from "../services/room/room.service";
import userService from "../services/user/user.service";
import janusService from "../services/webrtc/janus.service";
import { MediaTranscoderService } from "../services/webrtc/media.transcoder.service";
import { ROLES, EVENTS } from "../utils/constants";

export const initializeSockets = (io: Server) => {
  // Initialize the high-level role socket helper
  roleSocket.init(io);
  log.info("Initialized RoleSocketService wrapper successfully.");

  io.on("connection", async (socket: Socket) => {
    const { ID, Name, roomid } = socket.handshake.query;

    if (!ID || !Name || !roomid) {
      log.warn(`Rejected invalid connection attempt from socket: ${socket.id}`);
      socket.emit(EVENTS.ERROR, {
        msg: "Missing parameters (ID, Name, roomid).",
      });
      socket.disconnect();
      return;
    }

    // Resolve real user role from database — checks room-level observer/cohost lists first
    const role = await userService.getUserRole(ID as string, roomid as string);

    log.info(
      `Socket connected: ${socket.id} (User: ${Name}, Role: ${role}, Room: ${roomid})`,
    );

    // 1. Register Janus session for WebRTC streaming support
    janusService.removeSession({ uuid: ID as string, socketId: socket.id });
    janusService.addSession({
      uuid: ID as string,
      socketId: socket.id,
      notify: (event: string, payload: any) => {
        socket.emit(event, payload);
        if (
          event === EVENTS.WEBRTC &&
          payload.stream &&
          (payload.stream === "webcam" || payload.stream === "screen") &&
          payload.status === "down"
        ) {
          MediaTranscoderService.triggerVideoGeneration(
            ID as string,
            roomid as string,
          );
        }
      },
    });
    log.info(`[JanusSession] Initialized Janus session tracking for user: ${ID}`);

    // 2. Process join in Room Participants Service (cache state & update database)
    await roomParticipantsService.handleJoin(socket.id, {
      ID: ID as string,
      Name: Name as string,
      roomid: roomid as string,
      role: role,
    });

    // 3. Perform role-based socket room assignments
    const rid = roomid.toString();
    if (role === ROLES.TEACHER || role === ROLES.COHOST) {
      roleSocket.host.subscribe(socket, rid);
      log.info(`Socket ${socket.id} (${role}) subscribed to all host & telemetry channels.`);

      // Emit meeting-initiated to everyone in the room
      roleSocket.everyone.broadcast(rid, EVENTS.MEETING_INITIATED, {
        roomid: rid,
      });

      // Activate in-memory room state and persist (with race condition check)
      if (monetRooms[rid]) {
        if (!monetRooms[rid].active) {
          monetRooms[rid].active = true;
          try {
            await monetRooms[rid].persist({ alive: 1, meeting: "started" });
            monetRooms[rid].startFaceDetection();
          } catch (persistErr) {
            log.error(
              `[Presence] Failed to persist room state for ${rid}:`,
              persistErr as Error,
            );
          }
        }
      }
    } else if (role === ROLES.OBSERVER) {
      roleSocket.observer.subscribe(socket, rid);
      log.info(
        `Socket ${socket.id} (${role}) subscribed to observer telemetry channels.`,
      );
    } else {
      roleSocket.everyone.subscribe(socket, rid);
      log.info(`Socket ${socket.id} joined general room channel.`);
    }

    // Broadcast updated room list to everyone
    roomParticipantsService.emitRoomList(rid);

    // 4. Register modular feature socket listeners
    registerRoomSockets(io, socket);
    registerUserSockets(io, socket);
    registerWebRtcSockets(io, socket);

    socket.on(EVENTS.DISCONNECT, async (reason) => {
      log.info(`Socket disconnected: ${socket.id} (Reason: ${reason})`);
      // Evict from Room Participants Service and mark inactive in database
      const participant = await roomParticipantsService.handleLeave(socket.id);
      if (participant) {
        roomParticipantsService.emitRoomList(participant.roomid);
      }
    });
  });
};
