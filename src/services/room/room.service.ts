import { Room } from "../../models/rooms.model";
import { User, buildUserLookup } from "../../models/users.model";
import { Plan } from "../../models/plans.model";
import { PlanGroup } from "../../models/planGroups.model";
import janusService from "../webrtc/janus.service";
import roleSocket from "../socket/socket.role.service";
import log from "../logger/log";
import { AppError } from "../errors/app.error";
import redis from "../redis/redis.service";
import { MonetRoom } from "./monet.room.service";

// Map to hold in-memory MonetRoom instances
export const monetRooms: Record<string, any> = {};

export class RoomService {
  public async getInviteRoom(roomid: string) {
    if (!roomid) throw new AppError(400, "roomid parameter is required.");
    const room = await Room.findOne({ roomid });
    if (!room) throw new AppError(404, "The room does not exist");
    return room;
  }

  public async getAllRooms(email?: string) {
    if (!email) throw new AppError(400, "Email is required to fetch rooms.");
    const rooms = await Room.find({ creator_ID: email });
    if (!rooms || rooms.length === 0)
      throw new AppError(404, "Unable to find rooms");
    return rooms;
  }

  public async deleteRoom(sourceId: string) {
    if (!sourceId) throw new AppError(400, "Room ID parameter is required.");
    const result = await Room.deleteOne({ sourceId });
    if (result.deletedCount !== 1)
      throw new AppError(400, "unable to delete room");
  }

  /**
   * Spawns a live MonetRoom calling Janus and setups redis configurations.
   */
  public async createCall(body: any): Promise<any> {
    const {
      creator_ID,
      source,
      settings,
      summary,
      roomid,
      scheduled,
      coHostEmail,
    } = body;
    if (!roomid) {
      throw new AppError(400, "Roomid is required");
    }

    const user = await User.findOne(buildUserLookup(creator_ID));
    if (!user) {
      throw new AppError(404, "user not Found");
    }

    // Evaluate plan group monthly horas quota
    if (user.plan && user.plan.groupUid) {
      const planDetails = await PlanGroup.findOne({ uid: user.plan.groupUid });
      if (planDetails) {
        const leftHours = planDetails.totalHours - planDetails.usedHours;
        if (leftHours <= 0 || planDetails.usedHours >= planDetails.totalHours) {
          throw new AppError(
            405,
            "You have already consumed your monthly hours quota",
          );
        }
      }
    }

    try {
      // Connect to Janus webrtc room
      await janusService.createRoomByID({ roomid });

      let planRealTimeScores = 20;
      if (user.plan && user.plan.id) {
        const plan = await Plan.findById(user.plan.id);
        if (plan) {
          planRealTimeScores = plan.realTimeScores || 20;
        }
      }

      const details = {
        scheduled: scheduled ? true : false,
        creator_ID,
        source: !source ? "monet" : source,
        room: roomid,
        roomid: roomid,
        summary,
        coHostEmail: coHostEmail ?? "",
        settings: { ...settings, realTimeScores: planRealTimeScores },
        meeting: monetRooms[roomid]
          ? monetRooms[roomid].State.active
            ? "started"
            : monetRooms[roomid].meeting || "NaN"
          : "NaN",
      };

      const roomInstance = new MonetRoom(details);
      roomInstance.initializeRedis(redis as any);

      monetRooms[roomid] = roomInstance;
      this.registerMonetRoomEvents(roomInstance);

      log.info(
        `[Call] Successfully spawned meeting session for room ${roomid}`,
      );
      return details;
    } catch (err: any) {
      log.error("Failed to create room via Janus gateway", err);
      throw new AppError(201, `roomid Details: ${err.message || err.error || "Janus error"}`);
    }
  }

  /**
   * Forces manual Janus WebRTC room instantiation and registers it in the DB.
   */
  public async forceCreateRoom(roomid?: string): Promise<any> {
    if (!roomid) {
      throw new AppError(
        404,
        "Hey laddie, you did not provide me any information.",
      );
    }

    try {
      const res = await janusService.createRoomByID({ roomid });
      const details = {
        room: roomid,
        roomid: roomid,
      };

      const resObj = res?.response || {};
      if (resObj.error_code) {
        return { alreadyExists: true, details };
      }

      await Room.create(details);
      log.info(
        `[Call] Force created room successfully in DB and Janus: ${roomid}`,
      );
      return { alreadyExists: false, details };
    } catch (err: any) {
      log.error("Failed to force create room via Janus gateway", err);
      throw new AppError(201, `roomid Details: ${err.message || err.error || "Janus error"}`);
    }
  }

  /**
   * Registers in-memory observers notification events.
   */
  private registerMonetRoomEvents(monetRoom: any) {
    monetRoom.on("room-destroyed", () => {
      log.info(`[RoomService] Removing room ${monetRoom.roomid} from monetRooms memory map.`);
      delete monetRooms[monetRoom.roomid];
    });

    monetRoom.on("broadcast-room-metrics", (payload: any) => {
      const keyCount = Object.keys(payload.data).length;
      if (keyCount > 0) {
        roleSocket.observer.broadcast(monetRoom.roomid, "face-data", payload);
      }
    });

    monetRoom.on("broadcast-dialerData", (payload: any) => {
      roleSocket.observer.broadcast(monetRoom.roomid, "dialerData", payload);
    });

    monetRoom.on("broadcast-reactionData", (payload: any) => {
      roleSocket.observer.broadcast(monetRoom.roomid, "reactionData", payload);
    });

    monetRoom.on("broadcast-enter-call", (payload: any) => {
      roleSocket.observer.broadcast(monetRoom.roomid, "enter-call", payload);
    });

    monetRoom.on("broadcast-room-created", (payload: any) => {
      roleSocket.observer.broadcast(monetRoom.roomid, "room-created", payload);
    });
  }
}

export default new RoomService();
