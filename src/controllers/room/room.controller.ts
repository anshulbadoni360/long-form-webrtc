import { Request, Response } from "express";
import roomService from "../../services/room/room.service";
import log from "../../services/logger/log";
import { AppError } from "../../services/errors/app.error";
import { ResponseDto } from "../../services/DTO";

class RoomController {
  public async getInviteRoom(req: Request, res: Response) {
    try {
      const { roomid } = req.query;
      log.info(`Fetching invited room metadata for roomid ${roomid}`);
      const room = await roomService.getInviteRoom(roomid as string);
      res.json(ResponseDto.ok(room, "The room exists"));
    } catch (error: any) {
      log.error("Failed to verify invite room", error);
      if (error instanceof AppError) {
        return res.status(200).json(ResponseDto.fail(error.message));
      }
      return res
        .status(500)
        .json(ResponseDto.fail("Internal server error", error));
    }
  }

  public async getAllRooms(req: Request, res: Response) {
    try {
      const { email } = req.body;
      log.info(`Fetching all rooms created by ${email}`);
      const rooms = await roomService.getAllRooms(email);
      return res.json(ResponseDto.ok(rooms, "The room exists"));
    } catch (error: any) {
      log.error("Failed to retrieve rooms", error);
      if (error instanceof AppError) {
        return res.status(200).json(ResponseDto.fail(error.message));
      }
      return res
        .status(500)
        .json(ResponseDto.fail("Internal server error", error));
    }
  }

  public async deleteRoom(req: Request, res: Response) {
    try {
      const sourceId = req.params.id as string;
      log.info(`Deleting room with source ID: ${sourceId}`);
      await roomService.deleteRoom(sourceId);
      return res.json(ResponseDto.ok(null, "room deleted"));
    } catch (error: any) {
      log.error("Failed to delete room", error);
      if (error instanceof AppError) {
        return res.status(200).json(ResponseDto.fail(error.message));
      }
      return res
        .status(500)
        .json(ResponseDto.fail("Internal server error", error));
    }
  }

  public async createCall(req: Request, res: Response) {
    try {
      log.info(`API createCall triggered for roomid: ${req.body.roomid}`);
      const details = await roomService.createCall(req.body);
      res.json(ResponseDto.ok({details,roomid: req.body.roomid}, "Assign successfully"));
    } catch (error: any) {
      log.error("Failed to execute createCall session", error);
      if (error instanceof AppError) {
        return res.status(200).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Call not created", error.message));
    }
  }

  /**
   * HTTP GET Endpoint to manually/force create a WebRTC room.
   */
  public async forceCreateRoom(req: Request, res: Response) {
    try {
      const roomid = req.query.roomid as string;
      log.info(`API forceCreateRoom triggered for roomid: ${roomid}`);
      const result = await roomService.forceCreateRoom(roomid);

      if (result.alreadyExists) {
        return res.json(ResponseDto.ok(null, `The room ${roomid} already exists`));
      }

      // Standardized to ResponseDto
      return res.json(ResponseDto.ok(result.details, "Assign successfully"));
    } catch (error: any) {
      log.error("Failed to execute forceCreateRoom session", error);
      if (error instanceof AppError) {
        return res.status(200).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Call not created", error.message));
    }
  }
}

export default new RoomController();
