import { Router } from "express";
import {
  addNoteToOrder,
  adminDashboardData,
  approveRefunds,
  cancelDisputedOrder,
  changeFreelancerBadge,
  completeDisputedOrder,
  createAdminAccount,
  getFreelancers,
  getFreelancerStats,
  getJobs,
  getJobsStats,
  getMessagesByUsers,
  getMonthlyJobStats,
  getOrdersWithPartiesData,
  getRefunds,
  getTotalUserStats,
  getTrendingJobs,
  getUsers,
  loginAdminAccount,
  markOrderAsDisputed,
  orderStats,
  rejectRefunds,
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
AdminRouter.get(
  "/freelancers",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getFreelancers)
);
AdminRouter.get(
  "/order-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(orderStats)
);
AdminRouter.get(
  "/orders",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getOrdersWithPartiesData)
);
AdminRouter.get(
  "/messages",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getMessagesByUsers)
);
AdminRouter.get(
  "/refunds",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getRefunds)
);
AdminRouter.get(
  "/refunds/:id/reject",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(rejectRefunds)
);
AdminRouter.get(
  "/refunds/:id/approve",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(approveRefunds)
);


AdminRouter.post("/signup", createAdminAccount);
AdminRouter.post("/signin", loginAdminAccount);
AdminRouter.post(
  "/orders/:id/mark-disputed",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(markOrderAsDisputed)
);
AdminRouter.post(
  "/orders/:id/note",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(addNoteToOrder)
);
AdminRouter.post(
  "/orders/:id/complete",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(completeDisputedOrder)
);
AdminRouter.post(
  "/orders/:id/cancel",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(cancelDisputedOrder)
);

AdminRouter.put(
  "/freelancers/change-badge",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(changeFreelancerBadge)
);

export default AdminRouter;
