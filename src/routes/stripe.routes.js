import { Router } from "express";
import { verifyStripeSession } from "../database/models/stripe.controller.js";

const StripeRouter = Router();

StripeRouter.post("/verify-session", verifyStripeSession);

export default StripeRouter;
