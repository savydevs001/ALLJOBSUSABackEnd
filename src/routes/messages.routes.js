import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import { getMessagesWithProfile } from "../controllers/message.controller.js";
import a from "../utils/a.js";

const MessageRouter = Router();

MessageRouter.get("/:id", verifyTokenMiddleware(), a(getMessagesWithProfile));

export default MessageRouter;
