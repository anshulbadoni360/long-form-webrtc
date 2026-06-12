import { Socket } from "socket.io";
import roleSocket from "../../../services/socket/socket.role.service";
import { checkRole } from "../../../utils/socket/room";
import { User, buildUserLookup } from "../../../models/users.model";
import { Sessions } from "../../../models/sessions.model";
import { PostProcessingService } from "../../../services/room/post.processing.service";
import roomParticipantsService from "../../../services/socket/room.participants.service";
import log from "../../../services/logger/log";
import roomService from "../../../services/room/room.service";

/**
 * Handles administrative command controls, lobbies, and moderation panels.
 */
export default (on: any, socket: Socket) => {
  // --- Lobby Knock Commands ---

  on("join-request", (data: any) => {
    // check if room have any host or cohost present at the moment
    if (roomParticipantsService.getHostsInRoom(data.roomid).length === 0) {
      socket.emit("call-not-started");
      log.warn(
        "join-request: The moderator has not joined the room: " + data.roomid,
      );
      return;
    }

    roleSocket.host.broadcast(data.roomid, "join-request", {
      ...data,
      msg: "user requested to join the meeting",
      sid: socket.id, // always use server-verified socket ID, not client-supplied
    });
  });

  on("join-response", async (data: any) => {
    if (!checkRole(socket, "join-response", ["teacher", "cohost"])) return;

    const { join: joinList = [], ...rest } = data;

    // Enrich each entry in the join array with sid and group data
    // to match the old backend contract that the frontend expects.
    const enriched = await Promise.all(
      joinList.map(async (entry: any) => {
        const { uuid } = entry;

        // Resolve socket ID from in-memory participant store (O(1), no DB hit)
        const participant =
          roomParticipantsService.getParticipantByUserId(uuid);
        const sid = participant?.socketId ?? entry.sid;

        if (!sid) {
          log.warn(
            `[Moderation] Could not fetch socket ID for ${uuid} and not provided in join-response`,
          );
        }

        // Resolve group from the user's active session record
        let group: Record<string, any> | null = null;
        try {
          const session = await Sessions.findOne({ uuid, active: true }).lean();
          if (session?.janus?.group_id) {
            group = { group_id: session.janus.group_id };
          }
        } catch (err: any) {
          log.warn(
            `[Moderation] Could not fetch session group for ${uuid}: ${err.message}`,
          );
        }

        return {
          ...entry,
          sid,
          ...(group ? { group } : {}),
        };
      }),
    );

    roleSocket.everyone.broadcast(
      data.roomid || socket.handshake.query.roomid,
      "join-response",
      {
        uuid: rest.uuid,
        data: { join: enriched },
        msg: "can join the call",
        confirmed: true,
      },
      socket,
    );
  });

  // --- Host Commands ---

  on("admin-action", (data: any) => {
    if (!checkRole(socket, "admin-action", ["teacher", "cohost"])) return;
    roleSocket.everyone.broadcast(data.roomid, "admin-action", data);
  });

  on("start-recording", (data: any) => {
    if (!checkRole(socket, "start-recording", ["teacher", "cohost"])) return;
    roleSocket.everyone.broadcast(data.roomid, "start-recording", data);
  });

  on("publish-assignment", (data: any) => {
    if (!checkRole(socket, "publish-assignment", ["teacher", "cohost"])) return;
    roleSocket.everyone.broadcast(data.roomid, "assignment-broadcast", data);
  });

  on("throw-chalk", (data: any) => {
    if (!checkRole(socket, "throw-chalk", ["teacher", "cohost"])) return;
    roleSocket.everyone.send(data.targetSocketId, "throw-chalk", {
      msg: "Pay Attention",
      sender: socket.id,
    });
  });

  on("endRoom", (data: any) => {
    if (!checkRole(socket, "endRoom", ["teacher", "cohost"])) return;
    roleSocket.everyone.broadcast(data.roomid, "endRoom", data);

    const email = (socket.handshake.query.ID as string) || undefined;
    PostProcessingService.triggerPostProcessing(data.roomid, email).catch(
      (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        log.error(
          `[PostProcessing] Failed to execute triggerPostProcessing for room ${data.roomid}: ${message}`,
        );
      },
    );
  });

  on("destroy-group", (data: any) => {
    if (!checkRole(socket, "destroy-group", ["teacher", "cohost"])) return;
    roleSocket.everyone.broadcast(data.roomid, "destroy-group", data);
  });

  on("move-to-room", (data: any) => {
    if (!checkRole(socket, "move-to-room", ["teacher", "cohost"])) return;
    roleSocket.everyone.broadcast(data.roomid, "move-to-room", data);
  });

  on("stopScreen", (data: any) => {
    if (!checkRole(socket, "stopScreen", ["teacher", "cohost"])) return;
    roleSocket.everyone.broadcast(data.roomid, "stopScreen", data);
  });

  on("assignment", async (data: any) => {
    if (data.targets) {
      const { users = [], moderators = [], observers = [] } = data.targets;
      const targetUserIds = [...users, ...moderators, ...observers];

      for (const userId of targetUserIds) {
        const dbUser = await User.findOne(buildUserLookup(userId));
        if (dbUser && dbUser.sid) {
          roleSocket.everyone.send(dbUser.sid, "assignment", data);
        }
      }
    } else {
      roleSocket.everyone.broadcast(data.roomid, "assignment", data);
    }
  });
};
