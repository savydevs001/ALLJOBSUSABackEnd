import { Router } from "express";
import {
  createJob,
  getAllJobs,
  getAllSavedJobs,
  getJobById,
  removeSavedJob,
  saveAJob,
  // jobById,
  // updateJob,
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
  "/:id/save",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(saveAJob)
);
JobRouter.get(
  "/:id/remove-saved",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(removeSavedJob)
);
JobRouter.get("/:id", a(getJobById));

// JobRouter.get("/save/:id", a(saveAJob));
// JobRouter.get("/unsave/:id", a(removeSavedJob));
// JobRouter.get("/:id", a(jobById));

JobRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(createJob)
);

// JobRouter.put("/:id", a(updateJob));

// JobRouter.delete("/:id", a(deleteJob));

export default JobRouter;
