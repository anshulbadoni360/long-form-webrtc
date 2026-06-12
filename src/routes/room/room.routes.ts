import { Router } from "express";
import RoomController from "../../controllers/room/room.controller";

const room = Router();

room.get("/getInviteRoom", RoomController.getInviteRoom);
room.post("/getAllInviteRooms", RoomController.getAllRooms);
room.delete("/room/:id", RoomController.deleteRoom);
room.post("/createcall", RoomController.createCall);
room.get("/forceCreateRoom", RoomController.forceCreateRoom);

export default room;
