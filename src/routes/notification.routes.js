import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  getAllNotifications,
  getNotificationById,
} from "../controllers/notification.controller.js";

const NotificationRouter = Router();

NotificationRouter.get("/all", verifyTokenMiddleware(), a(getAllNotifications));
NotificationRouter.get("/:id", verifyTokenMiddleware(), a(getNotificationById));

export default NotificationRouter;
