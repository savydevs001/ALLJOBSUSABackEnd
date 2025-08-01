import { Router } from "express";
import { verifyStripeSession } from "../database/models/stripe.controller.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import {
  calculateTotalSubscriptionEarning,
  createPaymentIntents,
} from "../controllers/stripe.controller.js";

const StripeRouter = Router();

// StripeRouter.get(
//   "/subscription-earnings",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["admin"]),
//   a(calculateTotalSubscriptionEarning)
// );

StripeRouter.post("/verify-session", verifyStripeSession);

StripeRouter.post(
  "/create-intent",
  verifyTokenMiddleware(),
  createPaymentIntents
);

export default StripeRouter;
