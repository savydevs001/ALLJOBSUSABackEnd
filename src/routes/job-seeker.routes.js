import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import uploadProfilePictureMiddleware from "../middlewares/uploadProfilePicture.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  creatJobSeekerProfile,
  editJobSeekerProfile,
  getDashboardData,
  getJobSeekerList,
  getJobSeekerProfile,
  getJobSeekerProfileById,
  getUserJobStats,
} from "../controllers/job-seeker.js";

const JobSeekerRouter = Router();

JobSeekerRouter.get(
  "/profile",
  verifyTokenMiddleware(),
  a(getJobSeekerProfile)
);
JobSeekerRouter.get(
  "/dashboard",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker"]),
  a(getDashboardData)
);
JobSeekerRouter.get(
  "/job-stats",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["job-seeker"]),
  a(getUserJobStats)
);

JobSeekerRouter.get(
  "/all",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(getJobSeekerList)
);
JobSeekerRouter.get(
  "/profile/:id",
  verifyTokenMiddleware(),
  a(getJobSeekerProfileById)
);

JobSeekerRouter.post(
  "/profile",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  uploadProfilePictureMiddleware.single("file"),
  a(creatJobSeekerProfile)
);

JobSeekerRouter.put(
  "/profile",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  uploadProfilePictureMiddleware.fields([
    { name: "banner", maxCount: 1 },
    { name: "profile", maxCount: 1 },
  ]),
  a(editJobSeekerProfile)
);

export default JobSeekerRouter;
