import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import a from "../utils/a.js";
import {
  createSupportTicket,
  getAllSupportThreads,
  getSupportMessagesByTicket,
  getSupportTicket,
} from "../controllers/support.controller.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const SupportRouter = Router();

SupportRouter.get("/ticket", verifyTokenMiddleware(), a(getSupportTicket));

SupportRouter.get(
  "/all",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getAllSupportThreads)
);

SupportRouter.get(
  "/:ticketid",
  verifyTokenMiddleware(),
  a(getSupportMessagesByTicket)
);

SupportRouter.post("/new", verifyTokenMiddleware(), a(createSupportTicket));

export default SupportRouter;
