import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import { generatePaymentIntent } from "../controllers/transactions.controller.js";

const transactionRouter = Router();

transactionRouter.post(
  "/create-intent",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  generatePaymentIntent
);

export default transactionRouter;
