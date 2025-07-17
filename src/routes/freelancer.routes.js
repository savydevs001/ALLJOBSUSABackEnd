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
  // addFreelanceProfile,
  // bookmarkFreelancer,
  // enableFreelancerProfile,
  // getAllFreelancers,
  // getFreelancerProfileById,
  // unbookmarkFreelancer,
} from "../controllers/freelancer.controller.js";

const FreelancerRouter = Router();

// FreelancerRouter.get("/", a(getFreelancerProfile));
// FreelancerRouter.get("/all", a(getAllFreelancers));
// FreelancerRouter.get("/:id", a(getFreelancerProfileById));

// FreelancerRouter.post("/", a(addFreelanceProfile));
// FreelancerRouter.post(
//   "/activate",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["freelancer"]),
//   a(enableFreelancerProfile)
// );
// FreelancerRouter.post(
//   "/:id/bookmark",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["employer"]),
//   a(bookmarkFreelancer)
// );
// FreelancerRouter.post(
//   "/:id/remove-bookmark",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["employer"]),
//   a(unbookmarkFreelancer)
// );

// FreelancerRouter.put(
//   "/",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["freelancer"]),
//   a(editFreelanceProfile)
// );

FreelancerRouter.get(
  "/profile",
  verifyTokenMiddleware(),
  a(getFreelancerProfile)
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
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(getFreelancerEarnings)
);
FreelancerRouter.get(
  "/onbaord",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(startFreelancerOnboarding)
);
FreelancerRouter.get(
  "/onboarding-completed",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(checkOnboared)
);

FreelancerRouter.post(
  "/profile",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  uploadProfilePictureMiddleware.single("file"),
  a(creatFreelancerProfile)
);

FreelancerRouter.put(
  "/profile",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  uploadProfilePictureMiddleware.fields([
    { name: "banner", maxCount: 1 },
    { name: "profile", maxCount: 1 },
  ]),
  a(editFreelanceProfile)
);

export default FreelancerRouter;
