import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import { editMessage, getMessages } from "../controllers/message.controller.js";
import a from "../utils/a.js";

const MessageRouter = Router();

MessageRouter.get("/:id", verifyTokenMiddleware(), a(getMessages));
MessageRouter.put("/:id", verifyTokenMiddleware(), a(editMessage));

export default MessageRouter;
