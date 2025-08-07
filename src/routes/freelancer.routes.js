import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import uploadProfilePictureMiddleware from "../middlewares/uploadProfilePicture.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  getFreelancerProfile,
  creatFreelancerProfile,
  editFreelanceProfile,
  getUserJobStats,
  getFreelancerEarnings,
  startFreelancerOnboarding,
  checkOnboared,
  getDashboardData,
  getFreelanceProfileById,
  getFreelancerList,
  likeFreelancer,
  unlikeFreelancer,
  getFreelancerPaymentHistory,
  getMonthlyEarningsByFreelancer,
  getStripeFreelancerLogin,
  checkPaidForResume,
  downLoadResume,
  checkPaidForCoverLetter,
  downLoadCover,
  createFreelacneStripeAccount,
  createFreelacneStripeAccountOnBoardSession,
  checkFreelancerStripeAccountStatus,
} from "../controllers/freelancer.controller.js";

const FreelancerRouter = Router();

FreelancerRouter.get(
  "/profile",
  verifyTokenMiddleware(),
  a(getFreelancerProfile)
);
FreelancerRouter.get(
  "/dashboard",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(getDashboardData)
);
FreelancerRouter.get(
  "/job-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(getUserJobStats)
);
FreelancerRouter.get(
  "/earnings",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(getFreelancerEarnings)
);
FreelancerRouter.get(
  "/earnings-history",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(getFreelancerPaymentHistory)
);
FreelancerRouter.get(
  "/monthly-earnings",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(getMonthlyEarningsByFreelancer)
);
FreelancerRouter.get(
  "/onboarding-completed",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(checkOnboared)
);
FreelancerRouter.get(
  "/all",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  a(getFreelancerList)
);
FreelancerRouter.get(
  "/profile/:id",
  verifyTokenMiddleware(),
  a(getFreelanceProfileById)
);
FreelancerRouter.get("/:id/like", verifyTokenMiddleware(), a(likeFreelancer));
FreelancerRouter.get(
  "/:id/un-like",
  verifyTokenMiddleware(),
  a(unlikeFreelancer)
);
FreelancerRouter.get(
  "/stripe-login",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(getStripeFreelancerLogin)
);
FreelancerRouter.get(
  "/resume",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(checkPaidForResume)
);
FreelancerRouter.get(
  "/cover-letter",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(checkPaidForCoverLetter)
);

// FreelancerRouter.get(
//   "/create-connect-account",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["freelancer"]),
//   a(createFreelacneStripeAccount)
// );
// FreelancerRouter.get(
//   "/check-account-status",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["freelancer"]),
//   a(checkFreelancerStripeAccountStatus)
// );

FreelancerRouter.post(
  "/resume-download",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(downLoadResume)
);
FreelancerRouter.post(
  "/cover-letter-download",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(downLoadCover)
);
FreelancerRouter.post(
  "/profile",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  uploadProfilePictureMiddleware.single("file"),
  a(creatFreelancerProfile)
);
FreelancerRouter.post(
  "/onboard",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(startFreelancerOnboarding)
);
// FreelancerRouter.post(
//   "/create-onboarding-session",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["freelancer"]),
//   a(createFreelacneStripeAccountOnBoardSession)
// );

FreelancerRouter.put(
  "/profile",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  uploadProfilePictureMiddleware.fields([
    { name: "banner", maxCount: 1 },
    { name: "profile", maxCount: 1 },
  ]),
  a(editFreelanceProfile)
);

export default FreelancerRouter;
