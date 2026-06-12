import { Socket, Server } from "socket.io";
import roleSocket from "../../../services/socket/socket.role.service";
import roomParticipantsService from "../../../services/socket/room.participants.service";
import log from "../../../services/logger/log";
import { User, buildUserLookup } from "../../../models/users.model";
import socketUserService from "../../../services/socket/socket.user.service";
import { CreateUserPayload, PrivateMessagePayload } from "../../../types/socket/user.types";
import { EVENTS } from "../../../utils/constants";

export default (io: Server, socket: Socket) => {
  const on = (event: string, handler: (data: any) => void) => {
    socket.on(event, (data) => {
      const payload = data && typeof data === "object" ? data : {};

      if (!payload.roomid) {
        payload.roomid = socket.handshake.query.roomid;
      }

      handler(payload);
    });
  };

  on(EVENTS.CREATE_USER, async (data: CreateUserPayload) => {
    try {
      await socketUserService.createUser(socket, data);
    } catch (err: any) {
      log.error(`Error processing socket event "${EVENTS.CREATE_USER}":`, err);
      roleSocket.everyone.send(socket.id, EVENTS.ERROR, {
        msg: "An error occurred while creating user session.",
      });
    }
  });

  on(EVENTS.RE_MAP, async (data: { ID?: string }) => {
    try {
      const { ID } = data;
      if (!ID) {
        return roleSocket.everyone.send(socket.id, EVENTS.ERROR, {
          msg: "User ID is required for re-mapping.",
        });
      }
      log.info(`Re-mapping socket connection for user ID: ${ID}`);

      let roomid = "0";
      let name = "Reconnected User";

      // Check memory cache first
      const cachedParticipant = roomParticipantsService.getParticipantByUserId(ID);
      if (cachedParticipant) {
        roomid = cachedParticipant.roomid;
        name = cachedParticipant.name;
        log.info(`Resolved re-map details from cache for user: ${ID}`);
      } else {
        // Fall back to database query if cache miss
        const dbUser = await User.findOne(buildUserLookup(ID));
        if (dbUser) {
          roomid = dbUser.roomid || "0";
          name = dbUser.name || "Reconnected User";
          log.info(`Resolved re-map details from database for user: ${ID}`);
        }
      }

      await roomParticipantsService.handleJoin(socket.id, {
        ID,
        Name: name,
        roomid,
      });

      roomParticipantsService.emitRoomList(roomid);
    } catch (err: any) {
      log.error(`Error processing socket event "${EVENTS.RE_MAP}":`, err);
      roleSocket.everyone.send(socket.id, EVENTS.ERROR, {
        msg: "An error occurred while re-mapping connection.",
      });
    }
  });

  on(EVENTS.PRIVATE_MESSAGE, async (data: PrivateMessagePayload) => {
    try {
      const { uuid, msg } = data;
      if (!uuid || !msg) {
        return roleSocket.everyone.send(socket.id, EVENTS.ERROR, {
          msg: "Invalid private message payload.",
        });
      }
      log.info(
        `Private message attempt from socket ${socket.id} to user ${uuid}`,
      );

      // O(1) memory cache lookup instead of MongoDB hit
      const sid = roomParticipantsService.getSocketIdByUserId(uuid);
      if (!sid) {
        log.warn(`Private message failed: user ${uuid} is not online.`);
        return roleSocket.everyone.send(socket.id, EVENTS.ERROR, {
          msg: "Recipient is currently offline.",
        });
      }

      const sender = roomParticipantsService.getParticipant(socket.id);
      const senderName = sender ? sender.name : "Anonymous";

      // Relay message directly to target socket
      roleSocket.everyone.send(sid, EVENTS.PRIVATE_SEND_MESSAGE, {
        name: senderName,
        msg: msg,
      });
    } catch (err: any) {
      log.error(`Error processing socket event "${EVENTS.PRIVATE_MESSAGE}":`, err);
      roleSocket.everyone.send(socket.id, EVENTS.ERROR, {
        msg: "An error occurred while sending the private message.",
      });
    }
  });
};
