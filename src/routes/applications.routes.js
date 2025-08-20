import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import {
  createApplication,
  getApplicationById,
  getReceivedJobApplications,
  getUserApplications,
} from "../controllers/applications.controller.js";

const ApplicationRouter = Router();

ApplicationRouter.get(
  "/my-applications",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker", "freelancer"]),
  a(getUserApplications)
);

ApplicationRouter.get(
  "/received-applications",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(getReceivedJobApplications)
);

ApplicationRouter.get("/:id", verifyTokenMiddleware(), a(getApplicationById));

ApplicationRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker", "freelancer"]),
  a(createApplication)
);

export default ApplicationRouter;
