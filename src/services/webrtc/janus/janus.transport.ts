import { client as WebSocketClient, connection as WSConnection } from "websocket";
import log from "../../logger/log";
import { JanusConfig } from "../../../types/webrtc/janus.types";

interface Transaction {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeoutId: NodeJS.Timeout;
  isPluginMessage: boolean;
}

export class JanusTransport {
  private wsClient: WebSocketClient | null = null;
  private wsConnection: WSConnection | null = null;
  private transactions: Map<string, Transaction> = new Map();
  private keepAliveTimer: NodeJS.Timeout | null = null;
  private config: JanusConfig | null = null;
  private sessionID = 0;
  private state: "disconnected" | "connecting" | "connected" = "disconnected";
  private callbacks: Record<string, (...args: any[]) => void> = {};

  constructor() {}

  public initialize(config: JanusConfig): void {
    // deep clone config safely using structuredClone
    this.config = structuredClone(config);
    this.state = "disconnected";
    this.sessionID = 0;
  }

  public on(event: string, callback: (...args: any[]) => void): void {
    this.callbacks[event] = callback;
  }

  public isReady(): boolean {
    return this.state === "connected" && this.sessionID !== 0;
  }

  public getState(): "disconnected" | "connecting" | "connected" {
    return this.state;
  }

  public getSessionID(): number {
    return this.sessionID;
  }

  public getApiSecret(): string | null {
    return this.config?.janus.apiSecret || null;
  }

  public connect(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.config) {
        return reject(new Error("Janus Transport has not been initialized."));
      }

      if (this.state !== "disconnected" || this.wsClient) {
        log.warn("[JanusTransport] Already connected or connecting");
        return reject(new Error("Already connected or connecting"));
      }

      this.state = "connecting";
      this.wsClient = new WebSocketClient();

      const disconnectedCB = this.callbacks["disconnected"] || (() => {});

      this.wsClient.on("connectFailed", (error) => {
        log.error(`[JanusTransport] WS Connection Failed: ${error}`);
        this.cleanup();
        disconnectedCB();
        reject(error);
      });

      this.wsClient.on("connect", (connection) => {
        log.info("[JanusTransport] WebSocket Connected successfully.");
        this.wsConnection = connection;
        this.state = "connected";

        connection.on("error", (error) => {
          log.error(`[JanusTransport] WS Connection Error: ${error}`);
          this.cleanup();
          disconnectedCB();
        });

        connection.on("close", () => {
          log.info("[JanusTransport] WS Connection Closed.");
          this.cleanup();
          disconnectedCB();
        });

        connection.on("message", (message) => {
          if (message.type === "utf8" && message.utf8Data) {
            this.handleIncomingMessage(message.utf8Data);
          }
        });

        // Create the session
        this.send({ janus: "create" })
          .then((response) => {
            if (response.janus === "error") {
              const errMsg = response.error?.reason || "Unknown session creation error";
              log.error(`[JanusTransport] Session creation failed: ${errMsg}`);
              this.disconnect();
              reject(new Error(errMsg));
              return;
            }

            this.sessionID = response.data?.id || 0;
            log.info(`[JanusTransport] Session established. Session ID: ${this.sessionID}`);

            // Start KeepAlive
            this.startKeepAlive();
            resolve(this.sessionID);
          })
          .catch((err) => {
            this.disconnect();
            reject(err);
          });
      });

      this.wsClient.connect(this.config.janus.ws, "janus-protocol");
    });
  }

  private handleIncomingMessage(rawData: string): void {
    try {
      const json = JSON.parse(rawData);
      const transactionId = json.transaction;
      const eventType = json.janus;

      if (transactionId) {
        const tx = this.transactions.get(transactionId);
        if (tx) {
          if (eventType === "error") {
            clearTimeout(tx.timeoutId);
            this.transactions.delete(transactionId);
            tx.reject(new Error(json.error?.reason || "Janus error response"));
            return;
          }

          if (tx.isPluginMessage && eventType === "ack") {
            log.info(`[JanusTransport] Setup ACK received for transaction ${transactionId}. Waiting for result...`);
            return; // Wait for final event on same transaction
          }

          // Resolve and cleanup
          clearTimeout(tx.timeoutId);
          this.transactions.delete(transactionId);
          tx.resolve(json);
          return;
        }
      }

      // If no transaction ID or unhandled, emit to general message callback
      if (this.callbacks["message"]) {
        this.callbacks["message"](json);
      }
    } catch (err: any) {
      log.error(`[JanusTransport] Error parsing incoming message: ${err.message}`);
    }
  }

  public send(message: any, timeoutMs = 15000): Promise<any> {
    return new Promise((resolve, reject) => {
      if (!this.wsConnection) {
        return reject(new Error("WebSocket connection is not open."));
      }

      const transactionId = this.randomString(16);
      message.transaction = transactionId;

      const apiSecret = this.getApiSecret();
      if (apiSecret) {
        message.apisecret = apiSecret;
      }

      const isPluginMessage = message.janus === "message";

      const timeoutId = setTimeout(() => {
        if (this.transactions.has(transactionId)) {
          this.transactions.delete(transactionId);
          reject(new Error(`Transaction ${transactionId} timed out after ${timeoutMs}ms.`));
        }
      }, timeoutMs);

      this.transactions.set(transactionId, {
        resolve,
        reject,
        timeoutId,
        isPluginMessage,
      });

      this.wsConnection.sendUTF(JSON.stringify(message));
    });
  }

  private startKeepAlive(): void {
    this.keepAliveTimer = setInterval(() => {
      if (this.isReady()) {
        this.send({ janus: "keepalive", session_id: this.sessionID })
          .catch((err) => {
            log.error(`[JanusTransport] Keepalive failed: ${err.message}`);
          });
      }
    }, 15000);
  }

  public disconnect(): void {
    if (this.wsConnection) {
      try {
        this.wsConnection.close();
      } catch (e: any) {
        log.error(`[JanusTransport] Error during connection close: ${e.message}`);
      }
      this.wsConnection = null;
    }
    this.state = "disconnected";
  }

  private cleanup(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }

    // Cancel all pending transactions
    for (const [id, tx] of this.transactions.entries()) {
      clearTimeout(tx.timeoutId);
      tx.reject(new Error("Transport disconnected. Transaction cancelled."));
    }
    this.transactions.clear();

    this.sessionID = 0;
    this.state = "disconnected";
    this.wsClient = null;
  }

  public async invokeAdminApi(details: {
    plugin: string;
    request: any;
  }): Promise<any> {
    if (!this.config) {
      throw new Error("Janus configuration is missing.");
    }

    const { plugin, request } = details;
    const adminConfig = this.config.janus.admin;
    const url = `http://${adminConfig.hostname}:${adminConfig.port}${adminConfig.path}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const message = {
        janus: "message_plugin",
        transaction: this.randomString(12),
        admin_secret: adminConfig.secret,
        plugin,
        request,
      };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        throw new Error(`HTTP status ${res.status}`);
      }

      const parsed = (await res.json()) as any;

      if (parsed.janus === "error") {
        const errReason = parsed.error?.reason || "Unknown admin API error";
        log.error(`[JanusTransport] Admin API error response: ${JSON.stringify(parsed.error)}`);
        throw new Error(errReason);
      }

      return parsed.response;
    } catch (e: any) {
      clearTimeout(timeoutId);
      const isTimeout = e.name === "AbortError";
      const errMsg = isTimeout
        ? `[JanusTransport] Admin API request timed out after 10000ms at ${url}`
        : `[JanusTransport] Admin API connection error at ${url}: ${e.message}`;

      log.error(errMsg);
      throw e;
    }
  }

  private randomString(len: number): string {
    const charSet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let str = "";
    for (let i = 0; i < len; i++) {
      const pos = Math.floor(Math.random() * charSet.length);
      str += charSet.substring(pos, pos + 1);
    }
    return str;
  }
}
