import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  getUnreadConversationsCount,
  getUserConversations,
  markConversationAsRead,
} from "../controllers/conversation.controller.js";

const ConversationRouter = Router();

ConversationRouter.get(
  "/all",
  verifyTokenMiddleware(),
  a(getUserConversations)
);

ConversationRouter.get(
  "/unread-count",
  verifyTokenMiddleware(),
  a(getUnreadConversationsCount)
);

ConversationRouter.get(
  "/read/:id",
  verifyTokenMiddleware(),
  a(markConversationAsRead)
);

export default ConversationRouter;
