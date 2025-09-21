import { Router } from "express";
import a from "../utils/a.js";
import {
  createManagerAccount,
  generate2FASecret,
  loginManagerAccount,
  resetPassword,
  verify2FaSetup,
} from "../controllers/manager.controller.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const ManagerRouter = Router();

ManagerRouter.get(
  "/check-and-enable-2fa",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["manager"]),
  a(generate2FASecret)
);

ManagerRouter.post("/signup", a(createManagerAccount));
ManagerRouter.post("/signin", a(loginManagerAccount));


ManagerRouter.post(
  "/verify-2fa-setup",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["manager"]),
  a(verify2FaSetup)
);
ManagerRouter.post(
  "/password-reset",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["manager"]),
  a(resetPassword)
);

export default ManagerRouter;
