import { Router } from "express";
import {
  getHomePageAd,
  getPlateformCommission,
  setHomePageAd,
  updatePlateformCommision,
} from "../controllers/plateform.controller.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const PlateformRouter = Router();

PlateformRouter.get(
  "/commission",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  getPlateformCommission
);
PlateformRouter.get("/ad", getHomePageAd);

PlateformRouter.put(
  "/commission",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  updatePlateformCommision
);
PlateformRouter.put(
  "/ad",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  setHomePageAd
);

export default PlateformRouter;
