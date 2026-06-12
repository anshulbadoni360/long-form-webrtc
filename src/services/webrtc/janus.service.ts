import log from "../logger/log";
import { GStreamerService } from "./gstreamer.service";
import { IMediaGatewayProvider } from "../../types/socket/webrtc.types";
import {
  JanusConfig,
  RoomDetails,
  PublishDetails,
  SubscribeDetails,
} from "../../types/webrtc/janus.types";

// Import decomposed components
import { JanusTransport } from "./janus/janus.transport";
import { JanusSessionManager } from "./janus/janus.session";
import { VideoRoomPlugin } from "./janus/videoroom.plugin";
import { AudioBridgePlugin } from "./janus/audiobridge.plugin";
import { PortManager } from "./janus/port.manager";
import { RecordingManager } from "./janus/recording.manager";

const noop = () => {};

interface JanusIncomingEvent {
  janus: string;
  sender?: number;
  transaction?: string;
  plugindata?: {
    plugin: string;
    data: any;
  };
}

type JanusCallbackMap = {
  talking?: (data: any) => void;
  disconnected?: () => void;
  connected?: () => void;
  error?: (err: Error) => void;
  [key: string]: ((...args: any[]) => void) | undefined;
};

/**
 * JanusService coordinates WebSocket transport, sessions, plugins, recordings,
 * and GStreamer pipeline port allocations.
 *
 * For unit testing or DI: import the `JanusService` class.
 * For general application usage: import the default `janusService` singleton instance.
 */
export class JanusService implements IMediaGatewayProvider {
  private transport: JanusTransport;
  private sessionManager: JanusSessionManager;
  private videoRoom: VideoRoomPlugin;
  private audioBridge: AudioBridgePlugin;
  private portManager: PortManager;
  private recordingManager: RecordingManager | null = null;
  private gstPipes: Record<
    string,
    { service: GStreamerService; port: number }
  > = {};
  private config: JanusConfig | null = null;
  private callbacks: Partial<JanusCallbackMap> = {};

  private static readonly TRANSPORT_EVENTS = new Set([
    "disconnected",
    "connected",
    "error",
  ]);

  constructor(
    transport = new JanusTransport(),
    sessionManager = new JanusSessionManager(),
    portManager = new PortManager(2000, 65535),
  ) {
    this.transport = transport;
    this.sessionManager = sessionManager;
    this.portManager = portManager;

    const defaultSecret = "monet";
    this.videoRoom = new VideoRoomPlugin(
      this.transport,
      this.sessionManager,
      defaultSecret,
    );
    this.audioBridge = new AudioBridgePlugin(
      this.transport,
      this.sessionManager,
      defaultSecret,
    );

    // Setup transport general messages delegate
    this.transport.on("message", (json) => {
      this.handleIncomingEvent(json as JanusIncomingEvent);
    });
  }

  public initialize(janusConfig: JanusConfig): void {
    if (!this.config) {
      log.info("[JanusService] Initializing MonetJanus configuration...");
      this.config = structuredClone(janusConfig);

      // Separate global apiSecret from room/plugin secret
      const roomSecret = this.config.janus.roomSecret || "monet";
      this.videoRoom = new VideoRoomPlugin(
        this.transport,
        this.sessionManager,
        roomSecret,
      );
      this.audioBridge = new AudioBridgePlugin(
        this.transport,
        this.sessionManager,
        roomSecret,
      );

      this.transport.initialize(this.config);
      this.recordingManager = new RecordingManager(
        this.config.janus.recordings,
      );
    } else {
      log.warn(
        "[JanusService] Already initialized. Ignoring duplicate initialize() call.",
      );
    }
  }

  /**
   * Registers a callback listener for events.
   * Transport-specific events are forwarded directly to the transport client.
   */
  public on(event: string, callback: (...args: any[]) => void): void {
    this.callbacks[event] = callback;
    if (JanusService.TRANSPORT_EVENTS.has(event)) {
      this.transport.on(event, callback);
    }
  }

  public isReady(): boolean {
    return this.transport.isReady();
  }

  public getState(): string {
    return this.transport.getState();
  }

  public connect(callback?: (err?: any) => void): void {
    const cb = typeof callback === "function" ? callback : noop;
    this.transport
      .connect()
      .then(() => cb())
      .catch((err) => cb({ error: err.message || err }));
  }

  /**
   * Closes the active WebSocket connection and releases local resources.
   */
  public disconnect(): void {
    this.cleanupLocalResources();
    this.transport.disconnect();
  }

  /**
   * Clears connections and maps. Equal to disconnect() as JanusService is stateless
   * beyond active socket connections and transient GStreamer pipes.
   */
  public destroy(): void {
    this.disconnect();
  }

  /**
   * Adds a session for the given uuid and binds it to a specific socketId.
   * The socketId is used later to guard against stale disconnect race conditions.
   */
  public addSession(details: {
    uuid: string;
    socketId: string;
    notify: (event: string, payload: any) => void;
  }): void {
    this.sessionManager.addSession(
      details.uuid,
      details.socketId,
      details.notify,
    );
  }

  /**
   * Removes a session only if the calling socketId still owns it.
   * This prevents a stale disconnect from tearing down a session that was
   * already replaced by a fresh reconnect with the same uuid.
   */
  public async removeSession(details: {
    uuid: string;
    socketId: string;
  }): Promise<void> {
    const uuid = details.uuid;

    const session = this.sessionManager.getSession(uuid);

    // Guard: session does not exist — nothing to tear down
    if (!session) {
      // This is expected on a fresh first-connect where removeSession is called
      // defensively before addSession. Log at debug level, not warn.
      log.info(
        `[JanusService] removeSession called for ${uuid} but no session exists. Skipping.`,
      );
      return;
    }

    // Guard: the session belongs to a newer socket connection — do not remove it
    if (session.socketId !== details.socketId) {
      log.warn(
        `[JanusService] removeSession called by stale socket ${details.socketId} ` +
          `but session is owned by ${session.socketId}. ` +
          `Skipping to prevent race condition.`,
      );
      return;
    }

    log.info(`[JanusService] Removing session for uuid: ${uuid}`);

    // Attempt to hangup webcam/screen and await completion
    // to ensure safe session state deletion
    await Promise.allSettled([
      this.hangup({ uuid, stream: "webcam" }),
      this.hangup({ uuid, stream: "screen" }),
    ]);

    // Teardown GStreamer pipeline if active
    if (this.gstPipes[uuid]) {
      const { service, port } = this.gstPipes[uuid];
      try {
        service.stop();
      } catch (e: any) {
        log.error(
          `[JanusService] Error stopping GStreamer pipeline during removeSession for ${uuid}: ${e.message}`,
        );
      }
      this.portManager.releasePort(port);
      delete this.gstPipes[uuid];
      log.info(
        `[JanusService] Stopped and cleaned up GStreamer pipeline for uuid ${uuid}`,
      );
    }

    this.sessionManager.removeSession(uuid);
  }

  public createRoom(
    details: RoomDetails,
    callback?: (err: any, result?: any) => void,
  ): Promise<any> {
    return this.runAsync(this.videoRoom.createRoom(details), callback);
  }

  public createRoomByID(
    details: { roomid: string | number },
    callback?: (err: any, result?: any) => void,
  ): Promise<any> {
    const roomid = parseInt(details.roomid.toString(), 10);
    if (isNaN(roomid) || roomid <= 0) {
      const err = new Error(`Invalid room ID: ${details.roomid}`);
      callback?.({ error: err.message });
      return Promise.reject(err);
    }

    const createBothRooms = async () => {
      const videoRes = await this.videoRoom.createRoomByID(roomid);
      const audioRes = await this.audioBridge.createRoomByID(roomid);
      return {
        room: roomid,
        response: {
          "video-room": videoRes,
          "audio-room": audioRes,
        },
      };
    };

    return this.runAsync(createBothRooms(), callback);
  }

  public destroyRoom(
    details: RoomDetails,
    callback?: (err: any, result?: any) => void,
  ): Promise<any> {
    const roomVal = details.room ?? details.roomid;
    if (roomVal === undefined || roomVal === null) {
      const err = new Error("Missing mandatory attribute: room or roomid");
      callback?.({ error: err.message });
      return Promise.reject(err);
    }

    const room = parseInt(roomVal.toString(), 10);
    if (isNaN(room) || room <= 0) {
      const err = new Error(`Invalid room ID: ${roomVal}`);
      callback?.({ error: err.message });
      return Promise.reject(err);
    }

    return this.runAsync(this.videoRoom.destroyRoom(room), callback);
  }

  public checkRoom(
    room: number,
    callback: (err: any, result?: any) => void,
  ): Promise<any> {
    if (isNaN(room) || room <= 0) {
      const err = new Error(`Invalid room ID: ${room}`);
      callback?.({ error: err.message });
      return Promise.reject(err);
    }
    return this.runAsync(this.videoRoom.checkRoomExists(room), callback);
  }

  public forwardWebcam(
    details: { uuid: string; realTimeScores: number },
    callback?: (err?: any) => void,
  ): void {
    const cb = typeof callback === "function" ? callback : noop;
    const { uuid, realTimeScores } = details;

    if (!uuid) {
      return cb({ error: "Missing mandatory attribute: uuid" });
    }

    // Guard against duplicate forwarders
    if (this.gstPipes[uuid]) {
      log.warn(
        `[JanusService] GStreamer pipeline is already active for user ${uuid}`,
      );
      return cb({ error: "Pipeline already active" });
    }

    const session = this.sessionManager.getSession(uuid);
    if (!session) {
      return cb({ error: "No such session" });
    }

    const webcamHandle = session.handles["webcam"];
    const handleInfo = this.sessionManager.getHandle(webcamHandle);
    if (!webcamHandle || !handleInfo) {
      return cb({ error: `Webcam not published by ${uuid}` });
    }

    if (!this.recordingManager) {
      return cb({ error: "Recording manager is not initialized" });
    }

    const room = handleInfo.room;
    const publisher = handleInfo.publisher;

    try {
      const port = this.portManager.acquirePort();
      const imageFolder = this.recordingManager.getImageFolder(room, uuid);

      const gst = new GStreamerService({
        port,
        folder: imageFolder + "/",
        realTimeScores,
        onStarted: () => {
          log.info(
            `[JanusService] Configuring GStreamer RTP forwarder for ${uuid} on port ${port}...`,
          );

          const roomSecret = this.config?.janus.roomSecret || "monet";
          const rtpfwd = {
            request: "rtp_forward",
            secret: roomSecret,
            room,
            publisher_id: publisher,
            host: "127.0.0.1",
            video_port: port,
          };

          this.transport
            .invokeAdminApi({
              plugin: "janus.plugin.videoroom",
              request: rtpfwd,
            })
            .then((res) => {
              log.info(
                `[JanusService] Janus RTPForward Response: ${JSON.stringify(res)}`,
              );
              cb();
            })
            .catch((err) => {
              log.error("[JanusService] RTPForward setup failure:", err);
              gst.stop();
              this.portManager.releasePort(port);
              delete this.gstPipes[uuid];
              cb(err);
            });
        },
        onDone: (code) => {
          if (code === 0) {
            log.info(
              `[JanusService] GStreamer pipeline for ${uuid} finished cleanly.`,
            );
          } else {
            log.warn(
              `[JanusService] GStreamer pipeline for ${uuid} exited with code: ${code}`,
            );
          }
          this.portManager.releasePort(port);
          delete this.gstPipes[uuid];
        },
      });

      this.gstPipes[uuid] = { service: gst, port };
    } catch (err: any) {
      cb(err);
    }
  }

  public getParticipant(
    details: { room: string | number },
    callback: (err: any, result?: any) => void,
  ): Promise<any> {
    const room = parseInt(details.room.toString(), 10);
    if (isNaN(room) || room <= 0) {
      const err = new Error(`Invalid room ID: ${details.room}`);
      callback({ error: err.message });
      return Promise.reject(err);
    }
    return this.runAsync(this.videoRoom.getParticipants(room), callback);
  }

  public getAudioParticipant(
    details: { room: string | number },
    callback: (err: any, result?: any) => void,
  ): Promise<any> {
    const room = parseInt(details.room.toString(), 10);
    if (isNaN(room) || room <= 0) {
      const err = new Error(`Invalid room ID: ${details.room}`);
      callback({ error: err.message });
      return Promise.reject(err);
    }
    return this.runAsync(this.audioBridge.getParticipants(room), callback);
  }

  public publish(
    details: PublishDetails,
    callback?: (err: any, result?: any) => void,
  ): Promise<any> {
    if (!this.recordingManager) {
      const err = new Error("Recording manager is not initialized");
      callback?.({ error: err.message });
      return Promise.reject(err);
    }

    const recordingsDir = this.config?.janus.recordings || "";
    return this.runAsync(
      this.videoRoom.publish(details, recordingsDir),
      callback,
    );
  }

  public reNegotiate(
    details: PublishDetails,
    callback?: (err: any, result?: any) => void,
  ): Promise<any> {
    return this.runAsync(this.videoRoom.reNegotiate(details), callback);
  }

  public publishAudio(
    details: PublishDetails,
    callback?: (err: any, result?: any) => void,
  ): Promise<any> {
    const recordingsDir = this.config?.janus.recordings || "";
    return this.runAsync(
      this.audioBridge.publishAudio(details, recordingsDir),
      callback,
    );
  }

  public legacySubscribe(
    details: SubscribeDetails,
    callback?: (err: any, result?: any) => void,
  ): Promise<any> {
    return this.runAsync(this.videoRoom.legacySubscribe(details), callback);
  }

  public join(
    details: SubscribeDetails,
    callback?: (err: any, result?: any) => void,
  ): Promise<any> {
    const recordingsDir = this.config?.janus.recordings || "";
    return this.runAsync(this.videoRoom.join(details, recordingsDir), callback);
  }

  public start(
    details: { jsep: any; uuid: string; stream: string },
    callback?: (err?: any) => void,
  ): Promise<void> {
    return this.runAsync(this.videoRoom.start(details), callback);
  }

  public trickle(
    details: { candidate: any; uuid: string; stream: string },
    callback?: (err?: any) => void,
  ): Promise<void> {
    const { uuid, stream, candidate } = details;

    const session = this.sessionManager.getSession(uuid);
    if (!session) {
      const err = new Error("No session matching UUID");
      // Route through runAsync so callback receives the error
      // instead of throwing an unhandled rejection
      return this.runAsync(Promise.reject(err), callback);
    }

    const handle = session.handles[stream];
    const promise = !handle
      ? Promise.resolve(
          this.sessionManager.bufferCandidate(uuid, stream, candidate),
        )
      : this.transport.send({
          janus: "trickle",
          session_id: this.transport.getSessionID(),
          handle_id: handle,
          candidate,
        });

    return this.runAsync(
      promise.then(() => undefined),
      callback,
    );
  }

  public hangup(
    details: { uuid: string; stream: string },
    callback?: (err?: any) => void,
  ): Promise<void> {
    return this.runAsync(this.videoRoom.hangup(details), callback);
  }

  public audio(
    details: { status: string; uuid: string; room: string | number },
    callback: (err: any, result?: any) => void,
  ): Promise<any> {
    return this.runAsync(this.audioBridge.controlAudio(details), callback);
  }

  /**
   * Configures the hidden view for a participant.
   * Fire-and-forget — errors are logged but not propagated.
   */
  public hidden(details: { uuid: string; user: any }): void {
    this.videoRoom.configureHidden(details.uuid, details.user).catch((err) => {
      log.error(`[JanusService] Error configuring hidden view: ${err.message}`);
    });
  }

  public muteRoom(
    details: { status: string; uuid: string; room: string | number },
    callback: (err: any, result?: any) => void,
  ): Promise<any> {
    return this.runAsync(this.audioBridge.controlAudio(details), callback);
  }

  public getMyPubID(details: { uuid: string; stream: string }): number {
    const { uuid, stream } = details;
    const session = this.sessionManager.getSession(uuid);
    if (!session || !session.handles) return -1;

    const handle = session.handles[stream];
    if (!handle) return -1;

    const handleInfo = this.sessionManager.getHandle(handle);
    if (!handleInfo) return -1;

    const pubID = handleInfo.publisher;
    return typeof pubID === "number" ? pubID : -1;
  }

  private cleanupLocalResources(): void {
    // Teardown GStreamer pipelines and release their ports to prevent leaks
    for (const uuid of Object.keys(this.gstPipes)) {
      const { service, port } = this.gstPipes[uuid];
      try {
        service.stop();
      } catch (e: any) {
        log.error(
          `[JanusService] Error stopping GStreamer pipeline during cleanup for ${uuid}: ${e.message}`,
        );
      }
      this.portManager.releasePort(port);
    }
    this.gstPipes = {};

    this.sessionManager.clearAll();
  }

  private handleIncomingEvent(json: JanusIncomingEvent): void {
    const sender = json.sender;
    if (!sender) {
      log.info(
        `[JanusService] Unhandled event without sender: ${JSON.stringify(json)}`,
      );
      return;
    }

    const info = this.sessionManager.getHandle(sender);
    if (!info || !info.uuid) {
      // Handle may have already been cleaned up after session teardown — not an error
      log.info(
        `[JanusService] Ignoring event for already-removed handle ${sender}`,
      );
      return;
    }

    const uuid = info.uuid;
    const stream = info.stream || "";
    const session = this.sessionManager.getSession(uuid);
    if (!session) {
      log.warn(
        `[JanusService] No session ${uuid} related to untracked handle ${sender}`,
      );
      return;
    }

    const event = json.janus;
    log.info(`[JanusService] Received Janus event "${event}" for uuid: ${uuid}, stream: ${stream}`);
    if (event === "webrtcup") {
      log.info(`[JanusService] webrtcup! Notifying client socket of status "up" for stream "${stream}"`);
      session.notify("webrtc", { stream, status: "up" });
    } else if (event === "hangup") {
      log.info(`[JanusService] hangup! Notifying client socket of status "down" for stream "${stream}"`);
      session.notify("webrtc", { stream, status: "down" });
    } else if (event === "media") {
      log.info(`[JanusService] media status event: ${JSON.stringify(json)}`);
      // Janus 'media' events report audio/video receive status — informational only
    } else if (json.plugindata && json.plugindata.data) {
      const data = json.plugindata.data;
      const plugin = json.plugindata.plugin;

      if (plugin === "janus.plugin.audiobridge") {
        if (data.audiobridge === "talking") {
          // Resolve publisher uuid
          const pubInfo = this.sessionManager.getPublisher(data.id);
          const talkingCB = this.callbacks["talking"];
          if (typeof talkingCB === "function") {
            talkingCB({
              ...data,
              uuid: pubInfo ? pubInfo.uuid : null,
            });
          }
        }
      } else if (plugin === "janus.plugin.videoroom") {
        const vrevent = data.videoroom;
        if (vrevent === "event" && (data.unpublished || data.leaving)) {
          // A remote publisher unpublished or left — informational
          log.info(
            `[JanusService] VideoRoom participant ${data.unpublished ? "unpublished" : "left"}: feed ${data.unpublished ?? data.leaving} in room ${data.room}`,
          );
        } else {
          log.info(
            `[JanusService] VideoRoom event: ${JSON.stringify(data)}`,
          );
        }
      } else {
        log.info(`[JanusService] Unknown plugin data: ${JSON.stringify(json)}`);
      }
    } else {
      log.info(
        `[JanusService] Unhandled Janus event (${event}): ${JSON.stringify(json)}`,
      );
    }
  }

  /**
   * Helper utility to bridge Promise results to callbacks if provided.
   */
  private runAsync<T>(
    promise: Promise<T>,
    callback?: (err: any, result?: T) => void,
  ): Promise<T> {
    if (typeof callback === "function") {
      promise.then(
        (result) => callback(null, result),
        (err) => {
          const errMsg = err instanceof Error ? err.message : String(err);
          callback({ error: errMsg });
        },
      );
      // Suppress unhandled rejection on the returned promise
      // since the error is already handled and dispatched via the callback
      return promise.catch(() => undefined) as unknown as Promise<T>;
    }
    return promise;
  }
}

export const janusService = new JanusService();
export default janusService;
