import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import { completeOrder, createOrder, getFreelancerOrders } from "../controllers/order.controller.js";

const orderRouter = Router();

orderRouter.get(
  "/freelance-orders",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  getFreelancerOrders
);

orderRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  createOrder
);

orderRouter.put(
  "/:id/complete",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  completeOrder
);

export default orderRouter;
