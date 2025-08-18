import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  blockConversation,
  getBlockedUsers,
  getConversations,
  getMessagesWithProfile,
  getTotalUnseenMessages,
  unblockConversation,
} from "../controllers/message.controller.js";
import a from "../utils/a.js";

const MessageRouter = Router();

MessageRouter.get(
  "/conversations",
  verifyTokenMiddleware(),
  a(getConversations)
);
MessageRouter.get("/count", verifyTokenMiddleware(), a(getTotalUnseenMessages));
MessageRouter.get(
  "/blocked-users",
  verifyTokenMiddleware(),
  a(getBlockedUsers)
);
MessageRouter.get("/:id", verifyTokenMiddleware(), a(getMessagesWithProfile));

MessageRouter.post("/block", verifyTokenMiddleware(), a(blockConversation));
MessageRouter.post(
  "/un-block",
  verifyTokenMiddleware(),
  a(unblockConversation)
);

export default MessageRouter;
