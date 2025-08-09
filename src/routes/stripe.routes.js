import { Router } from "express";
import { verifyStripeSession } from "../database/models/stripe.controller.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import {
  calculateTotalSubscriptionEarning,
  cancelAutoRenewl,
  checkFreelancerPayoutSattus,
  createFreelancerPayout,
  createPaymentIntents,
} from "../controllers/stripe.controller.js";

const StripeRouter = Router();

// StripeRouter.get(
//   "/subscription-earnings",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["admin"]),
//   a(calculateTotalSubscriptionEarning)
// );

StripeRouter.get(
  "/freelancer-account-status",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(checkFreelancerPayoutSattus)
);

StripeRouter.post("/verify-session", verifyStripeSession);

StripeRouter.post(
  "/cancel-job-subscription",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(cancelAutoRenewl)
);
StripeRouter.post(
  "/create-intent",
  verifyTokenMiddleware(),
  createPaymentIntents
);
StripeRouter.post(
  "/freelancer-payout",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(createFreelancerPayout)
);

export default StripeRouter;
