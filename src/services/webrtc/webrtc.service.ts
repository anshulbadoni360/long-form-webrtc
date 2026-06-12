import janusService from "./janus.service";
import roomParticipantsService from "../socket/room.participants.service";
import roleSocket from "../socket/socket.role.service";
import log from "../logger/log";
import { User, buildUserLookup } from "../../models/users.model";

class WebRtcService {
  /**
   * Orchestrates publishing a webcam, screen, or audio stream.
   */
  public async publishStream(
    socketId: string,
    payload: { stream: string; jsep: any }
  ): Promise<any> {
    const participant = roomParticipantsService.getParticipant(socketId);
    if (!participant) {
      throw new Error(`No active participant session found for socket: ${socketId}`);
    }

    const { userId, roomid, name, role } = participant;

    log.info(`Participant ${name} (${userId}) is publishing stream: ${payload.stream}`);

    // Check if gateway is ready
    if (!janusService.isReady() || janusService.getState() !== "connected") {
      throw new Error("Media gateway is currently offline.");
    }

    const details = {
      user: {
        name,
        uuid: userId,
        proctor: role,
        streamType: payload.stream,
        janus: {
          roomid,
          video: true,
          webcam: true,
          audio: true,
          hidden: false,
          screen: payload.stream === "screen",
          streamType: payload.stream,
        },
      },
      stream: payload.stream,
      when: Date.now(),
      jsep: payload.jsep,
    };

    if (payload.stream === "webcam" || payload.stream === "screen") {
      try {
        const result = await janusService.publish(details);
        
        // Update DB user state
        await User.findOneAndUpdate(
          buildUserLookup(userId),
          { $set: { "janus.webcam": true, "janus.video": true } }
        );

        log.info(`Stream "${payload.stream}" published successfully for user ${userId}`);
        
        // Notify room of updated participant list
        this.broadcastRoomUpdate(roomid);

        return result;
      } catch (err: any) {
        log.error(`Failed to publish webcam/screen stream:`, err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    } else if (payload.stream === "audio") {
      try {
        const result = await janusService.publishAudio(details);

        await User.findOneAndUpdate(
          buildUserLookup(userId),
          { $set: { "janus.audio": true } }
        );

        log.info(`Audio stream published successfully for user ${userId}`);
        this.broadcastRoomUpdate(roomid);

        return result;
      } catch (err: any) {
        log.error(`Failed to publish audio stream:`, err instanceof Error ? err : new Error(String(err)));
        throw err;
      }
    } else {
      throw new Error(`Unsupported stream type: ${payload.stream}`);
    }
  }

  /**
   * Handles stream renegotiation (codec updates or media reconfiguration).
   */
  public async reNegotiateStream(
    socketId: string,
    payload: { stream: string; jsep: any }
  ): Promise<any> {
    const participant = roomParticipantsService.getParticipant(socketId);
    if (!participant) {
      throw new Error(`No active participant session found for socket: ${socketId}`);
    }

    const { userId, roomid, name, role } = participant;
    log.info(`Renegotiating stream: ${payload.stream} for participant ${name}`);

    const details = {
      user: {
        name,
        uuid: userId,
        proctor: role,
        streamType: payload.stream,
        janus: {
          roomid,
          video: true,
          webcam: true,
          audio: true,
          screen: payload.stream === "screen",
          streamType: payload.stream,
        },
      },
      stream: payload.stream,
      when: Date.now(),
      jsep: payload.jsep,
    };

    try {
      const result = await janusService.reNegotiate(details);
      log.info(`Stream "${payload.stream}" successfully renegotiated for user ${userId}`);
      return result;
    } catch (err: any) {
      log.error("Failed to renegotiate WebRTC stream:", err instanceof Error ? err : new Error(String(err)));
      throw err;
    }
  }

  /**
   * Feeds trickle ICE candidates to the gateway.
   */
  public trickleCandidate(socketId: string, payload: { stream: string; candidate: any }): void {
    const participant = roomParticipantsService.getParticipant(socketId);
    if (!participant) {
      log.error(`Cannot trickle ICE candidate: socket ${socketId} session not found.`);
      return;
    }

    janusService.trickle({
      uuid: participant.userId,
      stream: payload.stream,
      candidate: payload.candidate,
    }).catch((err) => {
      log.error(`[WebRtcService] Failed to trickle ICE candidate for user ${participant.userId}: ${err.message || err}`);
    });
  }

  /**
   * Broadcasts the updated room participant list.
   */
  private async broadcastRoomUpdate(roomid: string): Promise<void> {
    try {
      // Find all active users inside this room
      const activeUsers = await User.find({ roomid, active: true }).select("-password");
      roleSocket.everyone.broadcast(roomid, "room-list", { users: activeUsers });
      log.info(`Broadcasted updated participant list to room: ${roomid}`);
    } catch (error: any) {
      log.error("Error broadcasting room list update:", error);
    }
  }
}

export const webrtcService = new WebRtcService();
export default webrtcService;
