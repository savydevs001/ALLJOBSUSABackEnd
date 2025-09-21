import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  blockConversation,
  confidentialModeOff,
  confidentialModeOn,
  getBlockedUsers,
  getConversations,
  getMessagesWithProfile,
  getTotalUnseenMessages,
  unblockConversation,
} from "../controllers/message.controller.js";
import a from "../utils/a.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

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

MessageRouter.post(
  "/confidential-on",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(confidentialModeOn)
);
MessageRouter.post(
  "/confidential-off",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(confidentialModeOff)
);

export default MessageRouter;
