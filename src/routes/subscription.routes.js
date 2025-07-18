import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  createSubscription,
  enableProfileSubscription,
  getALlProfileSubsriptions,
  enableProfileFreeTrial,
} from "../controllers/subscriptions.controller.js";

const SubscriptionRouter = Router();

SubscriptionRouter.get(
  "/free-trial",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  enableProfileFreeTrial
);

SubscriptionRouter.get(
  "/profile-subscriptions",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "admin"]),
  getALlProfileSubsriptions
);

SubscriptionRouter.get(
  "/profile-subscriptions/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  enableProfileSubscription
);

SubscriptionRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  createSubscription
);

export default SubscriptionRouter;
