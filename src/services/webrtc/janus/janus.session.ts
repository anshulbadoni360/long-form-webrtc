import log from "../../logger/log";
import { JanusSession, JanusHandle } from "../../../types/webrtc/janus.types";

export class JanusSessionManager {
  private sessions: Map<string, JanusSession> = new Map();
  private handles: Map<number, JanusHandle> = new Map();
  private pubMap: Map<number, { uuid: string; handle: number; stream: string }> = new Map();

  constructor() {}

  /**
   * Adds an active participant session.
   */
  public addSession(uuid: string, socketId: string, notify: (event: string, payload: any) => void): void {
    if (this.sessions.has(uuid)) {
      log.warn(`[JanusSessionManager] Session ${uuid} already exists. Handling with care.`);
      return;
    }

    this.sessions.set(uuid, {
      uuid,
      socketId,
      notify,
      handles: {},
      newsession: {},
      candidates: {},
    });
    log.info(`[JanusSessionManager] Added session for user: ${uuid}`);
  }

  /**
   * Retrieves a session by UUID.
   */
  public getSession(uuid: string): JanusSession | undefined {
    return this.sessions.get(uuid);
  }

  /**
   * Removes a session by UUID.
   */
  public removeSession(uuid: string): void {
    this.sessions.delete(uuid);
    log.info(`[JanusSessionManager] Removed session for user: ${uuid}`);
  }

  /**
   * Registers a Janus plugin handle.
   */
  public registerHandle(handleId: number, handleData: JanusHandle): void {
    this.handles.set(handleId, handleData);
    log.info(`[JanusSessionManager] Registered handle ${handleId} for room ${handleData.room}`);
  }

  /**
   * Retrieves data associated with a handle.
   */
  public getHandle(handleId: number): JanusHandle | undefined {
    return this.handles.get(handleId);
  }

  /**
   * Removes a registered handle.
   */
  public removeHandle(handleId: number): void {
    this.handles.delete(handleId);
    log.info(`[JanusSessionManager] Removed handle ${handleId}`);
  }

  /**
   * Maps a publisher ID to its owner user and handle.
   */
  public registerPublisher(
    publisherId: number,
    pubData: { uuid: string; handle: number; stream: string }
  ): void {
    this.pubMap.set(publisherId, pubData);
    log.info(`[JanusSessionManager] Mapped publisher ${publisherId} to user ${pubData.uuid}`);
  }

  /**
   * Retrieves publisher metadata.
   */
  public getPublisher(publisherId: number): { uuid: string; handle: number; stream: string } | undefined {
    return this.pubMap.get(publisherId);
  }

  /**
   * Removes publisher mapping.
   */
  public removePublisher(publisherId: number): void {
    this.pubMap.delete(publisherId);
    log.info(`[JanusSessionManager] Unmapped publisher ${publisherId}`);
  }

  /**
   * Buffers ICE candidates for a user stream when the handle is not yet active.
   */
  public bufferCandidate(uuid: string, stream: string, candidate: any): void {
    const session = this.sessions.get(uuid);
    if (!session) {
      log.warn(`[JanusSessionManager] Cannot buffer candidate for non-existent session: ${uuid}`);
      return;
    }

    if (!session.candidates[stream]) {
      session.candidates[stream] = [];
    }
    session.candidates[stream].push(candidate);
    log.info(`[JanusSessionManager] Buffered candidate for ${uuid} stream ${stream}. Total: ${session.candidates[stream].length}`);
  }

  /**
   * Gets and clears buffered candidates.
   */
  public pullBufferedCandidates(uuid: string, stream: string): any[] {
    const session = this.sessions.get(uuid);
    if (!session || !session.candidates[stream]) {
      return [];
    }
    const candidates = session.candidates[stream];
    session.candidates[stream] = [];
    return candidates;
  }

  /**
   * Cleans up all session maps.
   */
  public clearAll(): void {
    this.sessions.clear();
    this.handles.clear();
    this.pubMap.clear();
    log.info("[JanusSessionManager] Cleared all sessions and handles from registry.");
  }
}
