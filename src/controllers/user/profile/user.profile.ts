import { Request, Response } from "express";
import userProfileService from "../../../services/user/profile/user.profile";
import { AppError } from "../../../services/errors/app.error";
import { ResponseDto } from "../../../services/DTO";

class UserProfileController {
  public async updateRole(req: Request, res: Response) {
    try {
      const { email, userType } = req.body;
      const user = await userProfileService.updateRole(email, userType);
      return res.json(ResponseDto.ok(user, "role updated"));
    } catch (error) {
      if (error instanceof AppError) {
        return res.status(error.status).json(ResponseDto.fail(error.message));
      }
      return res.status(500).json(ResponseDto.fail("Internal server error"));
    }
  }
}

export default new UserProfileController();
