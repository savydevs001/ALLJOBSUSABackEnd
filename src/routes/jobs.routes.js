import { Router } from "express";
import {
  jobById,
  getAllJobs,
  createJob,
  updateJob,
  deleteJob,
  saveAJob,
  removeSavedJob,
} from "../controllers/job.controller.js";
import a from "../utils/a.js";

const JobRouter = Router();

JobRouter.get("/all", a(getAllJobs));
JobRouter.get("/save/:id", a(saveAJob));
JobRouter.get("/unsave/:id", a(removeSavedJob));
JobRouter.get("/:id", a(jobById));

JobRouter.post("/", a(createJob));

JobRouter.put("/:id", a(updateJob));

JobRouter.delete("/:id", a(deleteJob));

export default JobRouter;
