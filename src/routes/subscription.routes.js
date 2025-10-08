import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  createSubscription,
  enableProfileSubscription,
  getALlProfileSubsriptions,
  enableProfileFreeTrial,
  updateProfileSubscriptions,
  enableMobilebasedSubscription,
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
  roleBasedAuthMiddleware(["employer", "admin", "manager"]),
  getALlProfileSubsriptions
);

SubscriptionRouter.get(
  "/profile-subscriptions/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  enableProfileSubscription
);


SubscriptionRouter.post(
  "/enable-susbcription",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  enableMobilebasedSubscription
);

SubscriptionRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  createSubscription
);

SubscriptionRouter.put(
  "/profile-subscriptions",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  updateProfileSubscriptions
);

export default SubscriptionRouter;
