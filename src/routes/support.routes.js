import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import a from "../utils/a.js";
import {
  getAllSupportThreads,
  getOrCreateSupportTicket,
  getSupportMessagesByTicket,
} from "../controllers/support.controller.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const SupportRouter = Router();

SupportRouter.get(
  "/ticket",
  verifyTokenMiddleware(),
  a(getOrCreateSupportTicket)
);
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

export default SupportRouter;
