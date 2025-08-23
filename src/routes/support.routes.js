import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import a from "../utils/a.js";
import {
  createSupportTicket,
  deleteSupportMessagesByTicket,
  getAllSupportThreads,
  getSupportMessagesByTicket,
  getSupportTicket,
  getUnreadSupportMessageCount,
} from "../controllers/support.controller.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const SupportRouter = Router();

SupportRouter.get("/ticket", verifyTokenMiddleware(), a(getSupportTicket));

SupportRouter.get(
  "/all",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getAllSupportThreads)
);
SupportRouter.get(
  "/count",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getUnreadSupportMessageCount)
);

SupportRouter.get(
  "/:ticketid",
  verifyTokenMiddleware(),
  a(getSupportMessagesByTicket)
);

SupportRouter.post("/new", verifyTokenMiddleware(), a(createSupportTicket));

SupportRouter.delete(
  "/:ticketid",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(deleteSupportMessagesByTicket)
);

export default SupportRouter;
