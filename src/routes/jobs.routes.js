import { Router } from "express";
import {
  applyToJob,
  closeAJob,
  createJob,
  getAllJobs,
  getAllSavedJobs,
  getJobApplicants,
  getJobById,
  getJobForEdit,
  myJobPostings,
  removeSavedJob,
  saveAJob,
  // jobById,
  updateJob,
  // deleteJob,
  // saveAJob,
  // removeSavedJob,
} from "../controllers/job.controller.js";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const JobRouter = Router();

JobRouter.get("/all", verifyTokenMiddleware("strict"), a(getAllJobs));
JobRouter.get("/saved", verifyTokenMiddleware("strict"), a(getAllSavedJobs));
JobRouter.get(
  "/my-postings",
  verifyTokenMiddleware("strict"),
  a(myJobPostings)
);
JobRouter.get(
  "/:id/save",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(saveAJob)
);
JobRouter.get(
  "/:id/remove-saved",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(removeSavedJob)
);
JobRouter.get(
  "/:id/edit",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  a(getJobForEdit)
);
JobRouter.get(
  "/:id/close",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  a(closeAJob)
);
JobRouter.get(
  "/:id/applicants",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker"]),
  a(getJobApplicants)
);
JobRouter.get(
  "/:id/apply",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer", "job-seeker"]),
  a(applyToJob)
);
JobRouter.get("/:id", verifyTokenMiddleware(), a(getJobById));

JobRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(createJob)
);

JobRouter.put("/:id", a(updateJob));

// JobRouter.delete("/:id", a(deleteJob));

export default JobRouter;
