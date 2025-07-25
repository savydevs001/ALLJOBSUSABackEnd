import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  createOffer,
  getOfferById,
  getReceivedOffers,
  getUserOffers,
  // acceptOffer,
  // editOffer,
  // getAllOffers,
  // getOfferById,
  // rejectOffer,
  // withdrawOffer,
} from "../controllers/offers.controllers.js";
import a from "../utils/a.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const OfferRouter = Router();

// OfferRouter.get("/withdraw/:id", verifyTokenMiddleware(), a(withdrawOffer));
// OfferRouter.get("/reject/:id", verifyTokenMiddleware(), a(rejectOffer));
// OfferRouter.get("/accept/:id", verifyTokenMiddleware(), a(acceptOffer));
// OfferRouter.get("/all", verifyTokenMiddleware(), a(getAllOffers));
// OfferRouter.get("/:id", verifyTokenMiddleware(), a(getOfferById));

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
  roleBasedAuthMiddleware(["employer", "freelancer", "job-seeker"]),
  a(getOfferById)
);


OfferRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer",]),
  a(createOffer)
);
OfferRouter.post(
  "/:jobid",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer",]),
  a(createOffer)
);

// OfferRouter.put("/:id", verifyTokenMiddleware(), a(editOffer));

export default OfferRouter;
