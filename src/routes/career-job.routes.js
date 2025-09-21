import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  applyToJob,
  createCareerJob,
  deleteCareerJob,
  editCareerJob,
  getAllCareerJobs,
  getCareerById,
} from "../controllers/career-job.controller.js";

const CareerJobRouter = Router();

CareerJobRouter.get("/all", a(getAllCareerJobs));
CareerJobRouter.get("/:id", verifyTokenMiddleware("weak"), a(getCareerById));

CareerJobRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(createCareerJob)
);

CareerJobRouter.post(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker", "employer"]),
  a(applyToJob)
);

CareerJobRouter.put(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(editCareerJob)
);

CareerJobRouter.delete(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(deleteCareerJob)
);

export default CareerJobRouter;
