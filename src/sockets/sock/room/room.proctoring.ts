import { Socket } from "socket.io";
import roleSocket from "../../../services/socket/socket.role.service";
import { checkRole } from "../../../utils/socket/room";

/**
 * Handles proctoring telemetry feeds and administrative monitor channels.
 */
export default (on: any, socket: Socket) => {
  on("face-data", (data: any) => {
    roleSocket.observer.broadcast(data.roomid, "face-data", {
      studentId: socket.id,
      ...data,
    });
  });

  on("dialerData", (data: any) => {
    roleSocket.observer.broadcast(data.roomid, "dialerData", {
      studentId: socket.id,
      ...data,
    });
  });

  on("toggle-visibility", (data: any) => {
    roleSocket.everyone.broadcast(
      data.roomid,
      "toggle-visibility",
      {
        data,
      },
      socket,
    );
  });

  on("add-manager", (data: any) => {
    if (!checkRole(socket, "add-manager", ["teacher", "cohost", "observer"]))
      return;
    const roomid = data.roomid.toString();

    // Subscribe observer socket to telemetry rooms
    roleSocket.observer.subscribe(socket, roomid);

    roleSocket.host.broadcast(roomid, "observer-list", {
      msg: "Observer joined",
    });
  });

  on("assignment-complete", (data: any) => {
    roleSocket.host.broadcast(data.roomid, "assignment-complete", {
      studentId: socket.id,
      ...data,
    });
  });

  on("reactionData", (data: any) => {
    roleSocket.observer.broadcast(data.roomid, "reactionData", {
      studentId: socket.id,
      ...data,
    });
  });

  on("room-created", (data: any) => {
    roleSocket.host.broadcast(data.roomid, "room-created", {
      studentId: socket.id,
      ...data,
    });
  });

  on("enter-call", (data: any) => {
    roleSocket.host.broadcast(data.roomid, "enter-call", {
      studentId: socket.id,
      ...data,
    });
  });

  on("question-response", (data: any) => {
    roleSocket.host.broadcast(data.roomid, "question-response", {
      studentId: socket.id,
      ...data,
    });
  });
};
