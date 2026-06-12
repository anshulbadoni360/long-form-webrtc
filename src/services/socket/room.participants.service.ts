import log from "../logger/log";
import { ActiveParticipant } from "../../types/socket/room.types";
import roleSocket from "./socket.role.service";
import { MediaTranscoderService } from "../webrtc/media.transcoder.service";
import { monetRooms } from "../room/room.service";
import userService from "../user/user.service";
import { User, buildUserLookup } from "../../models/users.model";

class RoomParticipantsService {
  // In-memory pools for active participants indexed by socketId
  private activeParticipants: Map<string, ActiveParticipant> = new Map();
  // User ID to socket ID memory cache for O(1) private messaging lookups
  private connectedUsers: Map<string, string> = new Map();
  // Disconnect grace timers indexed by userId (uuid)
  private disconnectTimers: Map<string, NodeJS.Timeout> = new Map();

  public async handleJoin(
    socketId: string,
    query: {
      ID?: string;
      Name?: string;
      roomid?: string;
      role?: string;
      groupId?: string;
    },
  ): Promise<ActiveParticipant | null> {
    const { ID, Name, roomid, role = "student", groupId } = query;

    if (!ID || !Name || !roomid) {
      log.warn(
        `Cannot process join for socket ${socketId}: missing query fields.`,
      );
      return null;
    }

    // If there was a pending disconnect timer for this user, clear it (graceful reconnect)
    const existingTimer = this.disconnectTimers.get(ID);
    if (existingTimer) {
      clearTimeout(existingTimer);
      this.disconnectTimers.delete(ID);
      log.info(
        `[RoomParticipants] Cleared leave timer for user ${Name}. User successfully reconnected.`,
      );
    }

    const participant: ActiveParticipant = {
      socketId,
      userId: ID,
      name: Name,
      roomid: roomid,
      role: role as any,
      webcam: false,
      screen: false,
      audio: false,
      video: false,
      raiseHand: false,
      groupId: groupId || null,
    };

    // Store in memory active pool
    this.activeParticipants.set(socketId, participant);
    // Store user ID to socket ID mapping in memory cache
    this.connectedUsers.set(ID, socketId);
    log.info(`[RoomParticipants] Cached socket state: ${Name} (${role})`);

    // Sync database state
    try {
      const success = await userService.updateUserSocketConnection(
        ID,
        socketId,
        roomid,
        role
      );
      if (success) {
        log.info(`[RoomParticipants] Persisted connection state for ${Name}`);
      }

      // Sync with MonetRoom active list
      if (monetRooms[roomid]) {
        monetRooms[roomid].addActiveParticipant(ID);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(
        `[RoomParticipants] Database sync failed during join for ${Name}: ${message}`,
      );
    }

    return participant;
  }

  public async handleLeave(
    socketId: string,
  ): Promise<ActiveParticipant | null> {
    const participant = this.activeParticipants.get(socketId);

    if (!participant) {
      log.warn(
        `[RoomParticipants] Socket ${socketId} left but was not tracked in-memory.`,
      );
      return null;
    }

    // Evict from in-memory active pool immediately
    this.activeParticipants.delete(socketId);
    // Evict from user to socket mapping if this socket is the current one mapped
    if (this.connectedUsers.get(participant.userId) === socketId) {
      this.connectedUsers.delete(participant.userId);
    }
    log.info(
      `[RoomParticipants] Evicted socket from in-memory: ${participant.name}`,
    );

    // Set a 10-second grace timer before making database offline edits and running transcoder
    const timer = setTimeout(async () => {
      this.disconnectTimers.delete(participant.userId);
      log.info(
        `[RoomParticipants] Leave grace period expired for ${participant.name}. Finalizing cleanup.`,
      );

      try {
        await userService.setUserOffline(participant.userId);
        log.info(`[RoomParticipants] Persisted offline state to database for ${participant.name}`);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        log.error(
          `[RoomParticipants] Database offline sync failed for ${participant.name}: ${message}`,
        );
      }

      // Clean up Janus session to free handles
      try {
        const janusService = (await import("../webrtc/janus.service")).default;
        janusService.removeSession({ uuid: participant.userId, socketId: participant.socketId });
        log.info(`[RoomParticipants] Removed Janus session for ${participant.name}`);
      } catch (err: any) {
        log.error(`[RoomParticipants] Failed to remove Janus session during leave for ${participant.name}: ${err.message}`);
      }

      // If user was actively streaming, trigger video post-processing transcoding
      if (participant.webcam || participant.video || participant.screen) {
        MediaTranscoderService.triggerVideoGeneration(
          participant.userId,
          participant.roomid,
        );
      }

      // Sync with MonetRoom active list
      if (monetRooms[participant.roomid]) {
        monetRooms[participant.roomid].removeActiveParticipant(participant.userId);
      }

      // Broadcast room list update to inform client panels
      this.emitRoomList(participant.roomid);
    }, 10000);

    this.disconnectTimers.set(participant.userId, timer);
    return participant;
  }

  public async updateMediaStatus(
    socketId: string,
    type: "webcam" | "screen" | "audio" | "video" | "raiseHand",
    enabled: boolean,
  ): Promise<ActiveParticipant | null> {
    const participant = this.activeParticipants.get(socketId);
    if (!participant) return null;

    participant[type] = enabled;

    try {
      const updateObj: any = {};
      updateObj[`janus.${type}`] = enabled;
      if (type === "video") {
        updateObj["janus.webcam"] = enabled;
      }

      await User.findOneAndUpdate(
        buildUserLookup(participant.userId),
        { $set: updateObj },
      );
      log.info(
        `[RoomParticipants] Updated ${type} status to ${enabled} for user ${participant.name}`,
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(
        `[RoomParticipants] Database status persist failed for ${participant.name}: ${message}`,
      );
    }

    return participant;
  }

  /**
   * Get an active participant by socket ID.
   */
  public getParticipant(socketId: string): ActiveParticipant | undefined {
    return this.activeParticipants.get(socketId);
  }

  /**
   * Get the socket ID associated with a user ID in O(1) time.
   */
  public getSocketIdByUserId(userId: string): string | undefined {
    return this.connectedUsers.get(userId);
  }

  /**
   * Look up an active participant by their user ID.
   */
  public getParticipantByUserId(userId: string): ActiveParticipant | undefined {
    return Array.from(this.activeParticipants.values()).find(
      (p) => p.userId === userId,
    );
  }

  public getParticipantsInRoom(roomid: string): ActiveParticipant[] {
    return Array.from(this.activeParticipants.values()).filter(
      (p) => p.roomid === roomid,
    );
  }

  public getObserversInRoom(roomid: string): ActiveParticipant[] {
    return Array.from(this.activeParticipants.values()).filter(
      (p) => p.roomid === roomid && p.role === "observer",
    );
  }

  public getHostsInRoom(roomid: string): ActiveParticipant[] {
    return Array.from(this.activeParticipants.values()).filter(
      (p) =>
        p.roomid === roomid && (p.role === "teacher" || p.role === "cohost"),
    );
  }

  public emitRoomList(roomid: string): void {
    const rid = roomid.toString();
    if (rid === "1234") return; // Skip legacy test room

    const participants = this.getParticipantsInRoom(rid);
    const roomList = participants.map((p) => ({
      userId: p.userId,
      name: p.name,
      role: p.role,
      socketId: p.socketId,
    }));

    log.info(
      `[RoomParticipants] Broadcasting room-list to room ${rid} (${roomList.length} users)`,
    );
    roleSocket.everyone.broadcast(rid, "room-list", {
      roomid: rid,
      data: roomList,
    });
  }
}

export const roomParticipantsService = new RoomParticipantsService();
export default roomParticipantsService;
