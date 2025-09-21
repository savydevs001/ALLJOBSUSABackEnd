import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import a from "../utils/a.js";
import {
  uploadFile,
} from "../controllers/upload.controller.js";
import uploadFileMiddleware from "../middlewares/uploadFile.middleware.js";

const uploadRouter = Router();

uploadRouter.post(
  "/",
  verifyTokenMiddleware(),
  uploadFileMiddleware.single("file"),
  a(uploadFile)
);

export default uploadRouter;
