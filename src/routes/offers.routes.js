import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import {
  acceptOffer,
  createOffer,
  editOffer,
  getAllOffers,
  getOfferById,
  rejectOffer,
  withdrawOffer,
} from "../controllers/offers.controllers.js";
import a from "../utils/a.js";

const OfferRouter = Router();

OfferRouter.get("/withdraw/:id", verifyTokenMiddleware(), a(withdrawOffer));
OfferRouter.get("/reject/:id", verifyTokenMiddleware(), a(rejectOffer));
OfferRouter.get("/accept/:id", verifyTokenMiddleware(), a(acceptOffer));
OfferRouter.get("/all", verifyTokenMiddleware(), a(getAllOffers));
OfferRouter.get("/:id", verifyTokenMiddleware(), a(getOfferById));

OfferRouter.post("/", verifyTokenMiddleware(), a(createOffer));

OfferRouter.put("/:id", verifyTokenMiddleware(), a(editOffer));

export default OfferRouter;
