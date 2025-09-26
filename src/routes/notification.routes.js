import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  getAllNotifications,
  getNotificationById,
  getNotificationCountById,
  notifyUser,
} from "../controllers/notification.controller.js";

const NotificationRouter = Router();

NotificationRouter.get("/all", verifyTokenMiddleware(), a(getAllNotifications));
NotificationRouter.get("/count", verifyTokenMiddleware(), a(getNotificationCountById));
NotificationRouter.get("/:id/mark-read", verifyTokenMiddleware(), a(getNotificationById));

// NotificationRouter.post("/temp", async(req, res)=>{
//   const {userId, userMail, title, message, from, ctaUrl, fcm_token} = req.body;
//   await notifyUser({userId, userMail, title, message, from, ctaUrl, fcm_token})
//   return res.json({message: "ok"})
// })

export default NotificationRouter;
