import log from "../../logger/log";
import { JanusTransport } from "./janus.transport";
import { JanusSessionManager } from "./janus.session";
import { RoomDetails, PublishDetails } from "../../../types/webrtc/janus.types";

export class AudioBridgePlugin {
  constructor(
    private transport: JanusTransport,
    private sessionManager: JanusSessionManager,
    private defaultSecret = "monet"
  ) {}

  public async createRoomByID(roomid: number): Promise<any> {
    const request = {
      request: "create",
      room: roomid,
      secret: this.defaultSecret,
      sampling_rate: 48000,
      permanent: false,
      audiolevel_ext: true,
      audiolevel_event: true,
      audio_active_packets: 100,
      audio_level_average: 25,
      notify_joining: true,
      record: true,
      record_file: "/tmp",
    };

    return this.transport.invokeAdminApi({
      plugin: "janus.plugin.audiobridge",
      request,
    });
  }

  public async getParticipants(roomid: number): Promise<any> {
    const request = {
      request: "listparticipants",
      room: roomid,
    };

    return this.transport.invokeAdminApi({
      plugin: "janus.plugin.audiobridge",
      request,
    });
  }

  public async publishAudio(details: PublishDetails, recordingsDir: string): Promise<any> {
    const { jsep, user, stream, when } = details;
    const { uuid, janus } = user;
    const room = parseInt(janus.roomid, 10);

    const session = this.sessionManager.getSession(uuid);
    if (!session) {
      throw new Error("No such session active.");
    }

    if (session.handles[stream] > 0) {
      throw new Error(`Audio stream ${stream} already published.`);
    }

    log.info(`[AudioBridgePlugin] Attaching AudioBridge handle for session ${uuid}`);
    const attachResponse = await this.transport.send({
      janus: "attach",
      session_id: this.transport.getSessionID(),
      plugin: "janus.plugin.audiobridge",
    });

    const handle = attachResponse.data?.id;
    if (!handle) {
      throw new Error("Failed to attach AudioBridge handle.");
    }

    session.handles[stream] = handle;
    this.sessionManager.registerHandle(handle, { uuid, stream, room, when });

    // Trickle buffered candidates if they exist
    const bufferedCandidates = this.sessionManager.pullBufferedCandidates(uuid, stream);
    if (bufferedCandidates.length > 0) {
      this.transport.send({
        janus: "trickle",
        session_id: this.transport.getSessionID(),
        handle_id: handle,
        candidates: bufferedCandidates,
      }).catch((err) => {
        log.error(`[AudioBridgePlugin] Trickle buffer candidate error: ${err.message}`);
      });
    }

    // Join the AudioBridge room
    const joinRes = await this.transport.send({
      janus: "message",
      session_id: this.transport.getSessionID(),
      handle_id: handle,
      body: {
        request: "join",
        room,
        audio_level_average: 25,
        audio_active_packets: 100,
      },
    });

    const joinData = joinRes.plugindata?.data;
    if (!joinData) {
      throw new Error("No plugindata returned from join AudioBridge request");
    }

    if (joinData.error) {
      throw new Error(joinData.error);
    }

    if (joinData.reason) {
      throw new Error(joinData.reason);
    }

    const publisherId = joinData.id;
    const handleInfo = this.sessionManager.getHandle(handle);
    if (handleInfo) {
      handleInfo.publisher = publisherId;
    }
    this.sessionManager.registerPublisher(publisherId, { uuid, handle, stream });

    // Configure (and start publishing with SDP)
    const confRes = await this.transport.send({
      janus: "message",
      session_id: this.transport.getSessionID(),
      handle_id: handle,
      body: {
        request: "configure",
        display: uuid,
        record: true,
        filename: `${recordingsDir}/${uuid}-webcam`,
      },
      jsep,
    });

    const confData = confRes.plugindata?.data;
    if (!confData) {
      throw new Error("No plugindata returned from configure AudioBridge request");
    }

    if (confData.error) {
      throw new Error(confData.error);
    }

    if (confData.reason) {
      throw new Error(confData.reason);
    }

    return {
      jsep: confRes.jsep,
      publisherID: publisherId,
      uuid,
    };
  }

  public async controlAudio(details: { status: string; uuid: string; room: string | number }): Promise<any> {
    const { status, uuid } = details;
    const room = parseInt(details.room.toString(), 10);
    const session = this.sessionManager.getSession(uuid);

    if (!session || !session.handles["audio"]) {
      throw new Error("Session or audio handle not found");
    }

    const handle = session.handles["audio"];
    const handleInfo = this.sessionManager.getHandle(handle);
    if (!handleInfo || handleInfo.publisher === undefined) {
      throw new Error("Audio handle publisher not found");
    }

    const id = handleInfo.publisher;

    return this.transport.invokeAdminApi({
      plugin: "janus.plugin.audiobridge",
      request: {
        request: status,
        id,
        room,
        secret: this.defaultSecret,
      },
    });
  }
}
