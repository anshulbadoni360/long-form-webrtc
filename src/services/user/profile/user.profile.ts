import { AppError } from "../../errors/app.error";
import { User } from "../../../models/users.model";

class UserProfileService {
  public async updateRole(email: string, userType: string) {
    if (!email) throw new AppError(400, "Email is required");
    if (!userType) throw new AppError(400, "UserType is required");

    const user = await User.findOneAndUpdate(
      {
        $or: [
          { email },
          { uuid: email },
          { ID: email }
        ]
      },
      { userType },
      { returnDocument: 'after' }
    );

    if (!user) throw new AppError(404, "User not found");

    return user;
  }
}

export default new UserProfileService();
