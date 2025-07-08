import { Router } from "express";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  addFreelanceProfile,
  bookmarkFreelancer,
  editFreelanceProfile,
  enableFreelancerProfile,
  getAllFreelancers,
  getFreelancerProfile,
  getFreelancerProfileById,
  unbookmarkFreelancer,
} from "../controllers/freelancer.controller.js";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";

const FreelancerRouter = Router();

FreelancerRouter.get("/", a(getFreelancerProfile));
FreelancerRouter.get("/all", a(getAllFreelancers));
FreelancerRouter.get("/:id", a(getFreelancerProfileById));

FreelancerRouter.post("/", a(addFreelanceProfile));
FreelancerRouter.post(
  "/activate",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(enableFreelancerProfile)
);
FreelancerRouter.post(
  "/:id/bookmark",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(bookmarkFreelancer)
);
FreelancerRouter.post(
  "/:id/remove-bookmark",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(unbookmarkFreelancer)
);

FreelancerRouter.put(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(editFreelanceProfile)
);

export default FreelancerRouter;
