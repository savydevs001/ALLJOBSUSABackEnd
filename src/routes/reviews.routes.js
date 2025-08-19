import { Router } from "express";
import {
  createReview,
  getFreelancerReviews,
} from "../controllers/reviews.controller.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";

const reviewRouter = Router();

reviewRouter.get("/:id", a(getFreelancerReviews));
reviewRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  a(createReview)
);

export default reviewRouter;
