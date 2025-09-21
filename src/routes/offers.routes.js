import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  createOffer,
  getOfferById,
  getOfferByIdForMessage,
  getReceivedOffers,
  getUserOffers,
  rejectOffer,
  withdrawOffer,
} from "../controllers/offers.controllers.js";
import a from "../utils/a.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const OfferRouter = Router();

OfferRouter.get(
  "/my-offers",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(getUserOffers)
);

OfferRouter.get(
  "/received-offers",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(getReceivedOffers)
);
OfferRouter.get(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware([
    "employer",
    "freelancer",
    "job-seeker",
    "admin",
    "manager",
  ]),
  a(getOfferById)
);
OfferRouter.get("/:id/overview", a(getOfferByIdForMessage));
OfferRouter.get(
  "/:id/reject",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  a(rejectOffer)
);
OfferRouter.get(
  "/:id/withdraw",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(withdrawOffer)
);

OfferRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(createOffer)
);
OfferRouter.post(
  "/:jobid",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(createOffer)
);

export default OfferRouter;
