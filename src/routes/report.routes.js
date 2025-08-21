import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import a from "../utils/a.js";
import { createReport } from "../controllers/report.controller.js";

const ReportRouter = Router();

ReportRouter.post("/", verifyTokenMiddleware(), a(createReport));

export default ReportRouter;
