import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  createEvent,
  deleteEvent,
  editEvent,
  getAllEvents,
  getEventById,
} from "../controllers/events.controller.js";

const EventRouter = Router();

EventRouter.get("/all", a(getAllEvents));
EventRouter.get("/:id", a(getEventById));

EventRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(createEvent)
);

EventRouter.put(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(editEvent)
);

EventRouter.delete(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(deleteEvent)
);

export default EventRouter;
