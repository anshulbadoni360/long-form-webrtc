import { Socket } from "socket.io";
import log from "../../services/logger/log";
import roomParticipantsService from "../../services/socket/room.participants.service";

export const checkRole = (socket: Socket, event: string, roles: string[]): boolean => {
  const participant = roomParticipantsService.getParticipant(socket.id);
  const userRole = (participant?.role || socket.handshake.query.role) as string;
  if (!roles.includes(userRole)) {
    log.warn(`Unauthorized attempt to emit "${event}" by socket ${socket.id} with role ${userRole}`);
    socket.emit("error", { msg: `Unauthorized action. Required: [${roles.join(", ")}]` });
    return false;
  }
  return true;
};