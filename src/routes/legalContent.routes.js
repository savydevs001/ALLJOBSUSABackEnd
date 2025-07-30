import { Router } from "express";
import {
  getLegalContent,
  updateContent,
} from "../controllers/legalContent.controller.js";
import a from "../utils/a.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";

const LegalContentRouter = Router();

LegalContentRouter.get("/:type", a(getLegalContent));
LegalContentRouter.post(
  "/:type",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(updateContent)
);

export default LegalContentRouter;
