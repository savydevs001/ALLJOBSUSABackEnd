import { Router } from "express";
import { createReview } from "../controllers/reviews.controller.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";

const reviewRouter = Router();

reviewRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(createReview)
);

export default reviewRouter;
