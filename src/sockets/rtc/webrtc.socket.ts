import { Socket, Server } from "socket.io";
import https from "node:https";
import webrtcService from "../../services/webrtc/webrtc.service";
import log from "../../services/logger/log";

export default (io: Server, socket: Socket) => {
  socket.on("publish", async (data) => {
    try {
      const { msg: message } = data || {};
      const { payload, id: transaction, monet: request } = message || {};

      if (!payload || !payload.stream || !payload.jsep) {
        log.warn(`Invalid publish payload received from socket: ${socket.id}`);
        return socket.emit("error", { msg: "Payload is missing mandatory WebRTC keys." });
      }

      const result = await webrtcService.publishStream(socket.id, payload);

      socket.emit("webrtc", {
        msg: {
          name: "published",
          monet: "event",
          id: transaction,
          data: request,
          type: payload.stream,
          payload: {
            jsep: result.jsep,
            msg: `published stream ${payload.stream} successfully.`,
          },
        },
      });
    } catch (err: any) {
      log.error(`WebRTC publish failed for socket: ${socket.id}`, err);
      socket.emit("error", { msg: err.message || "Failed to publish WebRTC media." });
    }
  });

  // --- 2. WebRTC Stream Re-Negotiation ---
  socket.on("re-negotiate", async (data) => {
    try {
      const { msg: message } = data || {};
      const { payload, id: transaction, monet: request } = message || {};

      if (!payload || !payload.stream || !payload.jsep) {
        log.warn(`Invalid renegotiate payload received from socket: ${socket.id}`);
        return socket.emit("error", { msg: "Payload is missing mandatory renegotiate keys." });
      }

      const result = await webrtcService.reNegotiateStream(socket.id, payload);

      socket.emit("webrtc", {
        msg: {
          name: "published",
          monet: "event",
          id: transaction,
          data: request,
          type: payload.stream,
          payload: {
            jsep: result.jsep,
            msg: `renegotiated stream ${payload.stream} successfully.`,
          },
        },
      });
    } catch (err: any) {
      log.error(`WebRTC renegotiate failed for socket: ${socket.id}`, err);
      socket.emit("error", { msg: err.message || "Failed to renegotiate WebRTC media." });
    }
  });

  // --- 3. WebRTC ICE Candidate Trickling ---
  socket.on("trickle", async (data) => {
    try {
      const { msg: message } = data || {};
      const { payload, id: transaction } = message || {};

      if (!payload || !payload.stream) {
        log.warn(`Invalid trickle payload received from socket: ${socket.id}`);
        return socket.emit("error", { msg: "Trickle candidate payload is missing stream details." });
      }

      webrtcService.trickleCandidate(socket.id, payload);

      socket.emit("success", { transaction, payload: "ice success" });
    } catch (err: any) {
      log.error(`WebRTC trickle failed for socket: ${socket.id}`, err);
      socket.emit("error", { msg: "ICE candidate trickling failed." });
    }
  });

  // --- 4. WebRTC ICE Server Details Request ---
  socket.on("ice-request", () => {
    sendIceServers(socket);
  });
};

export const sendIceServers = (socket: Socket) => {
  try {
    const body = JSON.stringify({ format: "urls" });
    const options = {
      host: "global.xirsys.net",
      path: "/_turn/RnDTurnServer",
      method: "PUT",
      headers: {
        Authorization: `Basic ${Buffer.from("Anandvats:970fe9a4-b043-11e9-aa8b-0242ac110003").toString("base64")}`,
        "Content-Type": "application/json",
        "Content-Length": body.length,
      },
    };

    let responseData = "";
    const req = https.request(options, (res) => {
      res.on("data", (chunk) => {
        responseData += chunk.toString("utf-8");
      });
      res.on("error", (e) => {
        log.error("Xirsys ICE request error on socket stream:", e);
        socket.emit("error", { msg: "Failed to query TURN/STUN settings." });
      });
      res.on("end", () => {
        try {
          const dataObject = JSON.parse(responseData);
          if (dataObject && dataObject.v && dataObject.v.iceServers) {
            dataObject.v.iceServers.urls.splice(1, 4);
            socket.emit("connected", {
              iceServers: [dataObject.v.iceServers],
            });
          } else {
            socket.emit("error", { msg: "Invalid response from ICE server." });
          }
        } catch (jsonErr) {
          log.error("Failed to parse Xirsys response:", jsonErr as any);
          socket.emit("error", { msg: "Malformed ICE settings payload received." });
        }
      });
    });

    req.on("error", (e) => {
      log.error("Xirsys connection request failed:", e as any);
      socket.emit("error", { msg: "Unable to establish ICE settings request." });
    });

    req.write(body);
    req.end();
  } catch (err: any) {
    log.error(`ICE request handler failed for socket: ${socket.id}`, err);
    socket.emit("error", { msg: "Internal ICE configuration error." });
  }
};
