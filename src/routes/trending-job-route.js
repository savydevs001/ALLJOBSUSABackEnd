import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import {
  createTrendingJob,
  deleteTrendingjob,
  getAllTrendingJobs,
  updateTrendingJOb,
} from "../controllers/trending-job.controller.js";

const TrendinJobRouter = new Router();

TrendinJobRouter.get("/all", a(getAllTrendingJobs));

TrendinJobRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(createTrendingJob)
);

TrendinJobRouter.put(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(updateTrendingJOb)
);

TrendinJobRouter.delete(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(deleteTrendingjob)
);

export default TrendinJobRouter;
