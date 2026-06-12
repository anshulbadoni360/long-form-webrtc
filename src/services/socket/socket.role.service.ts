import { Server, Socket } from "socket.io";

class RoleSocketService {
  private io!: Server;

  public init(io: Server) {
    this.io = io;
  }

  public observer = {
    subscribe: (socket: Socket, roomid: string) => {
      const rid = roomid.toString();
      // Observers only subscribe to core user telemetry feeds
      socket.join(`${rid}-face-data`);
      socket.join(`${rid}-dialerData`);
      socket.join(`${rid}-reactionData`);
    },
    broadcast: (roomid: string, event: string, data: any) => {
      if (this.io) {
        let suffix = "face-data";
        if (event === "dialerData") suffix = "dialerData";
        if (event === "reactionData") suffix = "reactionData";
        this.io.to(`${roomid.toString()}-${suffix}`).emit(event, data);
      }
    },
    send: (observerSocketId: string, event: string, data: any) => {
      if (this.io) {
        this.io.to(observerSocketId).emit(event, data);
      }
    },
  };

  public host = {
    subscribe: (socket: Socket, roomid: string) => {
      const rid = roomid.toString();
      // Hosts subscribe to moderation, administrative alerts, and telemetry feeds
      socket.join(`${rid}-hosts`);
      socket.join(`${rid}-face-data`);
      socket.join(`${rid}-dialerData`);
      socket.join(`${rid}-reactionData`);
      socket.join(`${rid}-enter-call`);
      socket.join(`${rid}-question-response`);
      socket.join(`${rid}-room-created`);
    },
    broadcast: (roomid: string, event: string, data: any) => {
      if (this.io) {
        let roomName = `${roomid.toString()}-hosts`;
        if (event === "enter-call")
          roomName = `${roomid.toString()}-enter-call`;
        if (event === "question-response")
          roomName = `${roomid.toString()}-question-response`;
        if (event === "room-created")
          roomName = `${roomid.toString()}-room-created`;
        this.io.to(roomName).emit(event, data);
      }
    },
    send: (hostSocketId: string, event: string, data: any) => {
      if (this.io) {
        this.io.to(hostSocketId).emit(event, data);
      }
    },
  };

  public everyone = {
    subscribe: (socket: Socket, roomid: string) => {
      socket.join(roomid.toString());
    },
    broadcast: (roomid: string, event: string, data: any, sender?: Socket) => {
      if (this.io) {
        sender
          ? sender.broadcast.to(roomid.toString()).emit(event, data)
          : this.io.to(roomid.toString()).emit(event, data);
      }
    },
    send: (socketId: string, event: string, data: any) => {
      if (this.io) {
        this.io.to(socketId).emit(event, data);
      }
    },
  };
}

export default new RoleSocketService();
