import log from "../../logger/log";
import { JanusTransport } from "./janus.transport";
import { JanusSessionManager } from "./janus.session";
import { RoomDetails, PublishDetails, SubscribeDetails } from "../../../types/webrtc/janus.types";

export class VideoRoomPlugin {
  constructor(
    private transport: JanusTransport,
    private sessionManager: JanusSessionManager,
    private defaultSecret = "monet"
  ) {}

  /**
   * Helper to attach a VideoRoom handle and optionally trickle candidate buffers.
   */
  private async attachAndSend(
    uuid: string,
    stream: string,
    body: any,
    jsep?: any,
    room?: number,
    when?: string | number,
    feed?: string
  ): Promise<{ handle: number; response: any }> {
    const session = this.sessionManager.getSession(uuid);
    if (!session) {
      throw new Error("No active session matching uuid.");
    }

    log.info(`[VideoRoomPlugin] Attaching VideoRoom handle for session ${uuid}, stream ${stream}`);
    const attachResponse = await this.transport.send({
      janus: "attach",
      session_id: this.transport.getSessionID(),
      plugin: "janus.plugin.videoroom",
    });

    const handle = attachResponse.data?.id;
    if (!handle) {
      throw new Error("Failed to attach VideoRoom handle.");
    }

    session.handles[stream] = handle;
    this.sessionManager.registerHandle(handle, { uuid, stream, room: room || 0, when, feed });

    // Trickle buffered candidates if they exist
    const bufferedCandidates = this.sessionManager.pullBufferedCandidates(uuid, stream);
    if (bufferedCandidates.length > 0) {
      this.transport.send({
        janus: "trickle",
        session_id: this.transport.getSessionID(),
        handle_id: handle,
        candidates: bufferedCandidates,
      }).catch((err) => {
        log.error(`[VideoRoomPlugin] Trickle buffer candidate error: ${err.message}`);
      });
    }

    const message: any = {
      janus: "message",
      session_id: this.transport.getSessionID(),
      handle_id: handle,
      body,
    };
    if (jsep) {
      message.jsep = jsep;
    }

    const response = await this.transport.send(message);
    return { handle, response };
  }

  public async createRoom(details: RoomDetails): Promise<any> {
    const request = {
      request: "create",
      secret: this.defaultSecret,
      sampling_rate: 20000,
      bitrate: 512000,
      audiocodec: "opus",
      videocodec: "vp8",
      publishers: 3600,
      audiolevel_ext: true,
      audiolevel_event: true,
      audio_active_packets: 100,
      audio_level_average: 50,
      notify_joining: true,
      ...details,
    };

    return this.transport.invokeAdminApi({
      plugin: "janus.plugin.videoroom",
      request,
    });
  }

  public async createRoomByID(roomid: number): Promise<any> {
    const request = {
      request: "create",
      room: roomid,
      secret: this.defaultSecret,
      bitrate: 512000,
      videocodec: "vp8",
      publishers: 3600,
      notify_joining: true,
    };

    return this.transport.invokeAdminApi({
      plugin: "janus.plugin.videoroom",
      request,
    });
  }

  public async destroyRoom(roomid: number): Promise<any> {
    const request = {
      request: "destroy",
      room: roomid,
      secret: this.defaultSecret,
    };

    return this.transport.invokeAdminApi({
      plugin: "janus.plugin.videoroom",
      request,
    });
  }

  public async checkRoomExists(roomid: number): Promise<any> {
    const request = {
      request: "exists",
      room: roomid,
    };

    return this.transport.invokeAdminApi({
      plugin: "janus.plugin.videoroom",
      request,
    });
  }

  public async getParticipants(roomid: number): Promise<any> {
    const request = {
      request: "listparticipants",
      room: roomid,
    };

    return this.transport.invokeAdminApi({
      plugin: "janus.plugin.videoroom",
      request,
    });
  }

  public async publish(details: PublishDetails, recordingsDir: string): Promise<any> {
    const { jsep, user, stream, when } = details;
    const { uuid, janus } = user;
    const room = parseInt(janus.roomid, 10);

    const body: any = {
      request: "joinandconfigure",
      room,
      ptype: "publisher",
      audio: false,
      video: true,
      record: true,
      display: JSON.stringify(user),
      filename: `${recordingsDir}/${uuid}-${stream}`,
    };

    // Increase bitrate for screenshare or special user IDs
    if (uuid.includes("___") || stream === "screen" || uuid.includes("-screen")) {
      body.bitrate = 2048000;
    }

    const { handle, response } = await this.attachAndSend(
      uuid,
      stream,
      body,
      jsep,
      room,
      when
    );

    const data = response.plugindata?.data;
    if (!data) {
      throw new Error("No plugindata returned from publish request");
    }

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.reason) {
      throw new Error(data.reason);
    }

    // Register publisher ID
    const handleInfo = this.sessionManager.getHandle(handle);
    if (handleInfo) {
      handleInfo.publisher = data.id;
    }

    return {
      jsep: response.jsep,
      publisherID: data.id,
      uuid,
    };
  }

  public async reNegotiate(details: PublishDetails): Promise<any> {
    const { jsep, user, stream } = details;
    const { uuid } = user;

    const session = this.sessionManager.getSession(uuid);
    if (!session) {
      throw new Error("No active session matching uuid.");
    }

    const handle = session.handles[stream];
    if (!handle) {
      throw new Error(`No handle found for stream ${stream}`);
    }

    const body = {
      request: "configure",
      audio: false,
      video: true,
    };

    const response = await this.transport.send({
      janus: "message",
      session_id: this.transport.getSessionID(),
      handle_id: handle,
      body,
      jsep,
    });

    const data = response.plugindata?.data;
    if (!data) {
      throw new Error("No plugindata returned from renegotiate request");
    }

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.reason) {
      throw new Error(data.reason);
    }

    // Update publisher ID
    const handleInfo = this.sessionManager.getHandle(handle);
    if (handleInfo) {
      handleInfo.publisher = data.id;
    }

    return {
      jsep: response.jsep,
      publisherID: data.id,
      uuid,
    };
  }

  public async legacySubscribe(details: SubscribeDetails): Promise<any> {
    const { uuid, feed, stream } = details;
    const room = parseInt(details.room.toString(), 10);

    const student = this.sessionManager.getSession(feed);
    if (!student) {
      throw new Error("Active publisher session not found");
    }

    const studentHandle = student.handles[stream];
    const studentInfo = this.sessionManager.getHandle(studentHandle);
    if (!studentHandle || !studentInfo || !studentInfo.publisher) {
      throw new Error(`${feed} is not publishing ${stream}`);
    }

    const publisher = studentInfo.publisher;

    const body = {
      request: "join",
      room,
      feed: publisher,
      ptype: "subscriber",
      audio: stream === "webcam",
      video: true,
    };

    const { response } = await this.attachAndSend(
      uuid,
      stream,
      body,
      undefined,
      room,
      undefined,
      feed
    );

    const data = response.plugindata?.data;
    if (!data) {
      throw new Error("No plugindata returned from legacySubscribe request");
    }

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.reason) {
      throw new Error(data.reason);
    }

    return {
      jsep: response.jsep,
    };
  }

  public async join(details: SubscribeDetails, recordingsDir: string): Promise<any> {
    const { uuid, feed, stream, jsep, when } = details;
    const room = parseInt(details.room.toString(), 10);

    const student = this.sessionManager.getSession(feed);
    if (!student) {
      throw new Error("Active publisher session not found");
    }

    const studentHandle = student.handles[stream];
    const studentInfo = this.sessionManager.getHandle(studentHandle);
    if (!studentHandle || !studentInfo || !studentInfo.publisher) {
      throw new Error(`${feed} not publishing ${stream}`);
    }

    const body = {
      request: "joinandconfigure",
      room,
      ptype: "publisher",
      audio: stream === "webcam",
      video: true,
      record: true,
      filename: `${recordingsDir}/${uuid}-${stream}`,
    };

    const { handle, response } = await this.attachAndSend(
      uuid,
      stream,
      body,
      jsep,
      room,
      when,
      feed
    );

    const data = response.plugindata?.data;
    if (!data) {
      throw new Error("No plugindata returned from join request");
    }

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.reason) {
      throw new Error(data.reason);
    }

    const handleInfo = this.sessionManager.getHandle(handle);
    if (handleInfo) {
      handleInfo.publisher = data.id;
    }

    return {
      jsep: response.jsep,
    };
  }

  public async start(details: { jsep: any; uuid: string; stream: string }): Promise<void> {
    const { jsep, uuid, stream } = details;
    const session = this.sessionManager.getSession(uuid);

    if (!session || !session.handles[stream]) {
      throw new Error("No ongoing subscription found");
    }

    const handle = session.handles[stream];
    const response = await this.transport.send({
      janus: "message",
      session_id: this.transport.getSessionID(),
      handle_id: handle,
      body: {
        request: "start",
      },
      jsep,
    });

    const data = response.plugindata?.data;
    if (!data) {
      throw new Error("No plugindata returned from start request");
    }

    if (data.error) {
      throw new Error(data.error);
    }

    if (data.reason) {
      throw new Error(data.reason);
    }
  }

  public async hangup(details: { uuid: string; stream: string }): Promise<void> {
    const { uuid, stream } = details;
    const session = this.sessionManager.getSession(uuid);

    if (!session || !session.handles[stream]) {
      throw new Error("WebRTC session not active for stream");
    }

    const handle = session.handles[stream];
    this.sessionManager.removeHandle(handle);
    delete session.handles[stream];
    delete session.candidates[stream];

    await this.transport.send({
      janus: "detach",
      session_id: this.transport.getSessionID(),
      handle_id: handle,
    });

    session.notify("webrtc", { stream, status: "down" });
  }

  public configureHidden(uuid: string, user: any): Promise<any> {
    const session = this.sessionManager.getSession(uuid);
    if (!session || !session.handles["webcam"]) {
      return Promise.resolve();
    }

    const handle = session.handles["webcam"];
    return this.transport.send({
      janus: "message",
      session_id: this.transport.getSessionID(),
      handle_id: handle,
      body: {
        request: "configure",
        display: JSON.stringify({ ...user }),
      },
    });
  }
}
