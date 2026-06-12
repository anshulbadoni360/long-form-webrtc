import { Router, Request, Response, NextFunction } from "express";
import path from "node:path";
import jwt from "jsonwebtoken";
import { ResponseDto } from "../../services/DTO";
import adminController from "../../controllers/admin/admin.controller";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "slave-secret-key-12345";

// Static view serving remains in route
router.get("/admin/settings", (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, "../../views/slaveSettings.html"));
});

// Authentication routes
router.post("/api/admin/login", adminController.login);

// Admin authentication middleware
const authAdmin = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json(ResponseDto.fail("Unauthorized: Missing or invalid token"));
  }
  const token = authHeader.split(" ")[1];
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res
      .status(401)
      .json(ResponseDto.fail("Unauthorized: Invalid or expired token"));
  }
};

// Admin protected endpoints
router.get("/api/admin/settings", authAdmin, adminController.getSettings);
router.post("/api/admin/settings", authAdmin, adminController.updateSettings);
router.get("/api/rooms", authAdmin, adminController.getRooms);
router.delete("/api/rooms/:roomid", authAdmin, adminController.killRoom);
router.get("/api/admin/logs", authAdmin, adminController.getLogs);

export default router;
