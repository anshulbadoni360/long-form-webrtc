import { Socket } from "socket.io";
import { CreateUserPayload } from "../../types/socket/user.types";
import roleSocket from "./socket.role.service";
import roomParticipantsService from "./room.participants.service";
import userService from "../user/user.service";
import { monetRooms } from "../room/room.service";
import { sendIceServers } from "../../sockets/rtc/webrtc.socket";
import log from "../logger/log";
import { ROLES, EVENTS } from "../../utils/constants";

class SocketUserService {
  /**
   * Performs user registration, database connection updates, room activation,
   * channel subscriptions, and ICE server distribution.
   */
  public async createUser(socket: Socket, payload: CreateUserPayload): Promise<void> {
    const { user } = payload;
    const userId = user?.ID || user?.uuid || user?.email || (socket.handshake.query.ID as string);

    if (!user || !userId || !user.roomid) {
      log.warn(`[SocketUserService] User creation failed: invalid details for socket ${socket.id}`);
      roleSocket.everyone.send(socket.id, EVENTS.ERROR, {
        msg: "Invalid user details provided.",
      });
      return;
    }

    log.info(`[SocketUserService] Creating session and mapping socket for user: ${user.name} (${userId})`);

    const role = user.proctor || ROLES.STUDENT;
    const rid = user.roomid.toString();

    // Update the active participant's role in the memory cache
    const participant = roomParticipantsService.getParticipant(socket.id);
    if (participant) {
      participant.role = role as any;
    }

    // Sync and update database record with the role from the handshake/payload
    await userService.updateUserSocketConnection(
      userId,
      socket.id,
      rid,
      role
    );

    // Perform role-based socket subscriptions dynamically
    if (role === ROLES.TEACHER || role === ROLES.COHOST) {
      roleSocket.host.subscribe(socket, rid);
      log.info(
        `[SocketUserService] Socket ${socket.id} (${role}) subscribed to host & telemetry channels.`,
      );

      // Emit meeting-initiated to everyone in the room
      roleSocket.everyone.broadcast(rid, EVENTS.MEETING_INITIATED, "meeting initiated");

      // Activate in-memory room state and start face detection
      if (monetRooms[rid]) {
        if (!monetRooms[rid].active) {
          monetRooms[rid].active = true;
          try {
            await monetRooms[rid].persist({ alive: 1, meeting: "started" });
            monetRooms[rid].startFaceDetection();
          } catch (persistErr) {
            log.error(
              `[SocketUserService] [Presence] Failed to persist room state for ${rid}:`,
              persistErr as Error,
            );
          }
        }
      }
    } else if (role === ROLES.OBSERVER) {
      roleSocket.observer.subscribe(socket, rid);
      log.info(
        `[SocketUserService] Socket ${socket.id} (${role}) subscribed to observer telemetry channels.`,
      );
    } else {
      roleSocket.everyone.subscribe(socket, rid);
      log.info(`[SocketUserService] Socket ${socket.id} joined general room channel.`);
    }

    // Announce the connection state
    roleSocket.everyone.broadcast(rid, EVENTS.NEW_USER, {
      socketId: socket.id,
      name: user.name,
      userId: userId,
    });

    // Broadcast updated room list
    roomParticipantsService.emitRoomList(rid);

    // Trigger ICE servers retrieval and emit 'connected' event to the client
    sendIceServers(socket);
  }
}

export const socketUserService = new SocketUserService();
export default socketUserService;
