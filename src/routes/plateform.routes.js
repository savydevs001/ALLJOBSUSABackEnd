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
  roleBasedAuthMiddleware(["admin", "manager"]),
  getPlateformCommission
);
PlateformRouter.get("/ad", getHomePageAd);

PlateformRouter.put(
  "/commission",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  updatePlateformCommision
);

PlateformRouter.put(
  "/ad",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  setHomePageAd
);

export default PlateformRouter;
