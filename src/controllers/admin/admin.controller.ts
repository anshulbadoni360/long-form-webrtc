import { Request, Response } from "express";
import adminService from "../../services/admin/admin.service";
import { ResponseDto } from "../../services/DTO";
import { AppError } from "../../services/errors/app.error";

class AdminController {
  public login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const token = adminService.login(username, password);
      return res.json(ResponseDto.ok({ token }, "Authenticated successfully"));
    } catch (error: any) {
      if (error instanceof AppError) {
        return res.status(error.status).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Internal server error"));
    }
  }

  public getSettings(req: Request, res: Response) {
    try {
      const settings = adminService.getSettings();
      return res.json(ResponseDto.ok(settings, "Fetched slave runtime settings"));
    } catch (error: any) {
      if (error instanceof AppError) {
        return res.status(error.status).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Internal server error"));
    }
  }

  public updateSettings(req: Request, res: Response) {
    try {
      const { cpuThreshold, ramThreshold, publicIp } = req.body;
      const settings = adminService.updateSettings(cpuThreshold, ramThreshold, publicIp);
      return res.json(ResponseDto.ok(settings, "Updated slave runtime settings"));
    } catch (error: any) {
      if (error instanceof AppError) {
        return res.status(error.status).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Internal server error"));
    }
  }

  public getRooms(req: Request, res: Response) {
    try {
      const rooms = adminService.getRooms();
      return res.json(ResponseDto.ok(rooms, "Fetched active rooms"));
    } catch (error: any) {
      if (error instanceof AppError) {
        return res.status(error.status).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Internal server error"));
    }
  }

  public async killRoom(req: Request, res: Response) {
    try {
      const roomid = req.params.roomid;
      if (typeof roomid !== "string") {
        return res.status(400).json(ResponseDto.fail("Invalid room ID"));
      }
      await adminService.killRoom(roomid);
      return res.json(ResponseDto.ok(null, `Room ${roomid} killed successfully.`));
    } catch (error: any) {
      if (error instanceof AppError) {
        return res.status(error.status).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Internal server error"));
    }
  }

  public async getLogs(req: Request, res: Response) {
    try {
      const logs = await adminService.getLogs();
      return res.json(ResponseDto.ok(logs, "Logs retrieved successfully"));
    } catch (error: any) {
      if (error instanceof AppError) {
        return res.status(error.status).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Internal server error"));
    }
  }
}

export default new AdminController();
