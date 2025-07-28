import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  // completeOrder,
  createOrder,
  delieverOrderForRevsions,
  getClientOrders,
  getFreelancerOrders,
  markAsDelieverd,
  markOrderAsComplete,
} from "../controllers/order.controller.js";

const orderRouter = Router();

orderRouter.get(
  "/freelance-orders",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  getFreelancerOrders
);

orderRouter.get(
  "/client-orders",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  getClientOrders
);

orderRouter.get(
  "/:id/mark-complete",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  markOrderAsComplete
);
// orderRouter.put(
//   "/:id/complete",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["employer"]),
//   completeOrder
// );
orderRouter.get(
  "/:id/mark-revision",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  delieverOrderForRevsions
);
orderRouter.get(
  "/:id/mark-delievered",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  markAsDelieverd
);

orderRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  createOrder
);

export default orderRouter;
