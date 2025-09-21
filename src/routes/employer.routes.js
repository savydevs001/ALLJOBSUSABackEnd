import { Router } from "express";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  editEmployerProfile,
  getEmployerDashboardData,
  getEmployerProfile,
  getEmployerProfileById,
} from "../controllers/employer.controler.js";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";

const EmployerRouter = Router();

EmployerRouter.get(
  "/dashboard",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(getEmployerDashboardData)
);
EmployerRouter.get(
  "/profile",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(getEmployerProfile)
);
EmployerRouter.get("/profile/:id", a(getEmployerProfileById));

EmployerRouter.put(
  "/profile/edit",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(editEmployerProfile)
);

export default EmployerRouter;
