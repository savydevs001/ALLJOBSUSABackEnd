import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  getConversations,
  getMessagesWithProfile,
  getTotalUnseenMessages,
  // getUnreadMessageCount,
} from "../controllers/message.controller.js";
import a from "../utils/a.js";

const MessageRouter = Router();

MessageRouter.get(
  "/conversations",
  verifyTokenMiddleware(),
  a(getConversations)
);
MessageRouter.get("/count", verifyTokenMiddleware(), a(getTotalUnseenMessages));
MessageRouter.get("/:id", verifyTokenMiddleware(), a(getMessagesWithProfile));

export default MessageRouter;
