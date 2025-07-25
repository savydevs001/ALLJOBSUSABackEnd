import { Router } from "express";
import {
  adminDashboardData,
  createAdminAccount,
  getMonthlyJobStats,
  loginAdminAccount,
} from "../controllers/admin.controller.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";

const AdminRouter = Router();

AdminRouter.get(
  "/dashboard",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(adminDashboardData)
);
AdminRouter.get(
  "/monthly-job-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getMonthlyJobStats)
);

AdminRouter.post("/signup", createAdminAccount);
AdminRouter.post("/signin", loginAdminAccount);

export default AdminRouter;
