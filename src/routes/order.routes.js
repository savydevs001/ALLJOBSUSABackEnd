import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import { completeOrder, createOrder } from "../controllers/order.controller.js";

const orderRouter = Router();

orderRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  createOrder
);

orderRouter.put(
  "/:id/complete",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  completeOrder
);

export default orderRouter;
