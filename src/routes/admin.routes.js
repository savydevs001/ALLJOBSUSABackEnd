import { Router } from "express";
import {
  adminDashboardData,
  createAdminAccount,
  getFreelancerStats,
  getJobs,
  getJobsStats,
  getMonthlyJobStats,
  getTotalUserStats,
  getTrendingJobs,
  getUsers,
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
AdminRouter.get(
  "/user-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getTotalUserStats)
);
AdminRouter.get(
  "/users",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getUsers)
);
AdminRouter.get(
  "/job-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getJobsStats)
);
AdminRouter.get(
  "/jobs",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getJobs)
);
AdminRouter.get(
  "/trending-jobs",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getTrendingJobs)
);
AdminRouter.get(
  "/freelancer-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getFreelancerStats)
);


AdminRouter.post("/signup", createAdminAccount);
AdminRouter.post("/signin", loginAdminAccount);

export default AdminRouter;
