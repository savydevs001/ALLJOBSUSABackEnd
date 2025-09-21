import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import {
  cancelAutoRenewl,
  checkFreelancerPayoutSattus,
  createFreelancerPayout,
  createPaymentIntents,
  checkPaidForResume,
  checkPaidForCoverLetter,
  downLoadResume,
  downLoadCover,
  verifyStripePaymentInetnt,
  ResumeAutoRenewlSusbcription,
} from "../controllers/stripe.controller.js";

const StripeRouter = Router();

StripeRouter.get(
  "/freelancer-account-status",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(checkFreelancerPayoutSattus)
);
StripeRouter.get(
  "/resume-paid",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "employer", "job-seeker"]),
  a(checkPaidForResume)
);
StripeRouter.get(
  "/cover-letter-paid",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "employer", "job-seeker"]),
  a(checkPaidForCoverLetter)
);

StripeRouter.post("/verify-intent", verifyStripePaymentInetnt);

StripeRouter.post(
  "/cancel-job-subscription",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(cancelAutoRenewl)
);
StripeRouter.post(
  "/continue-job-subscription",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(ResumeAutoRenewlSusbcription)
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
StripeRouter.post(
  "/resume-download",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "employer", "job-seeker"]),
  a(downLoadResume)
);
StripeRouter.post(
  "/cover-letter-download",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "employer", "job-seeker"]),
  a(downLoadCover)
);

export default StripeRouter;
