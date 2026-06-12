import { Router } from "express";
import UserProfileController from "../../../controllers/user/profile/user.profile";

const profile = Router();

profile.put("/updateRole", UserProfileController.updateRole);

export default profile;
