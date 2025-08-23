import { Router } from "express";
import {
  addNoteToOrder,
  adminDashboardData,
  approveRefunds,
  cancelDisputedOrder,
  changeFreelancerBadge,
  completeDisputedOrder,
  createAdminAccount,
  deleteUser,
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
  suspendUser,
  unSuspendUser,
} from "../controllers/admin.controller.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";

const AdminRouter = Router();

AdminRouter.get(
  "/dashboard",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(adminDashboardData)
);
AdminRouter.get(
  "/monthly-job-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getMonthlyJobStats)
);
AdminRouter.get(
  "/user-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getTotalUserStats)
);
AdminRouter.get(
  "/users",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getUsers)
);
AdminRouter.get(
  "/job-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getJobsStats)
);
AdminRouter.get(
  "/jobs",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getJobs)
);
AdminRouter.get(
  "/trending-jobs",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getTrendingJobs)
);
AdminRouter.get(
  "/freelancer-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getFreelancerStats)
);
AdminRouter.get(
  "/freelancers",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getFreelancers)
);
AdminRouter.get(
  "/order-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(orderStats)
);
AdminRouter.get(
  "/orders",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getOrdersWithPartiesData)
);
AdminRouter.get(
  "/messages",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getMessagesByUsers)
);
AdminRouter.get(
  "/refunds",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(getRefunds)
);
AdminRouter.get(
  "/refunds/:id/reject",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(rejectRefunds)
);
AdminRouter.get(
  "/refunds/:id/approve",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(approveRefunds)
);

// AdminRouter.post("/signup", a(createAdminAccount));
AdminRouter.post("/signin", a(loginAdminAccount));
AdminRouter.post(
  "/orders/:id/mark-disputed",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(markOrderAsDisputed)
);
AdminRouter.post(
  "/orders/:id/note",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(addNoteToOrder)
);
AdminRouter.post(
  "/orders/:id/complete",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(completeDisputedOrder)
);
AdminRouter.post(
  "/orders/:id/cancel",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(cancelDisputedOrder)
);
AdminRouter.post(
  "/suspend-user/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(suspendUser)
);
AdminRouter.post(
  "/delete-user/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(deleteUser)
);
AdminRouter.post(
  "/activate-user/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(unSuspendUser)
);

AdminRouter.put(
  "/freelancers/change-badge",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(changeFreelancerBadge)
);

export default AdminRouter;
