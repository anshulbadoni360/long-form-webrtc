import { Socket } from "socket.io";
import roleSocket from "../../../services/socket/socket.role.service";
import roomParticipantsService from "../../../services/socket/room.participants.service";

/**
 * Handles general participant interactions and toggles inside a room.
 */
export default (on: any, socket: Socket) => {
  on("raise-hand", (data: any) => {
    roleSocket.everyone.broadcast(data.roomid, "raise-hand", {
      from: socket.id,
      ...data,
    });
    roomParticipantsService.updateMediaStatus(socket.id, "raiseHand", data.raiseHand || false);
  });

  on("speaking", (data: any) => {
    roleSocket.everyone.broadcast(data.roomid, "speaking", {
      from: socket.id,
      ...data,
    });
  });

  on("room-chat", (data: any) => {
    roleSocket.everyone.broadcast(data.roomid, "room-chat", {
      from: socket.id,
      ...data,
    });
  });

  on("toggle-audio", (data: any) => {
    roleSocket.everyone.broadcast(data.roomid, "room-audio", {
      from: socket.id,
      ...data,
    });
    // Update mic/audio status
    const enabled = data.audio !== undefined ? data.audio : (data.status !== undefined ? data.status : !data.mute);
    roomParticipantsService.updateMediaStatus(socket.id, "audio", enabled).then(() => {
      roomParticipantsService.emitRoomList(data.roomid);
    });
  });

  on("toggle-name", (data: any) => {
    const p = roomParticipantsService.getParticipant(socket.id);
    if (p && data.name) {
      p.name = data.name;
    }
    roleSocket.everyone.broadcast(data.roomid, "toggle-name", {
      from: socket.id,
      ...data,
    });
    roomParticipantsService.emitRoomList(data.roomid);
  });

  on("screen-share-stopped", (data: any) => {
    roleSocket.everyone.broadcast(data.roomid, "screen-share-stopped", {
      from: socket.id,
      ...data,
    });
    roomParticipantsService.updateMediaStatus(socket.id, "screen", false);
  });

  on("video-started", (data: any) => {
    roleSocket.everyone.broadcast(data.roomid, "video-started", {
      from: socket.id,
      ...data,
    });
  });

  on("toggle-video", (data: any) => {
    roleSocket.everyone.broadcast(data.roomid, "toggle-video", {
      from: socket.id,
      ...data,
    });
    const enabled = data.video !== undefined ? data.video : (data.status !== undefined ? data.status : !data.mute);
    roomParticipantsService.updateMediaStatus(socket.id, "video", enabled).then(() => {
      roomParticipantsService.emitRoomList(data.roomid);
    });
  });

  on("end-discussion", (data: any) => {
    roleSocket.everyone.broadcast(data.roomid, "end-discussion", {
      from: socket.id,
      ...data,
    });
  });
};
