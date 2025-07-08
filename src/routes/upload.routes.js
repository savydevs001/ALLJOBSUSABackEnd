import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import uploadProfilePictureMiddleware from "../middlewares/uploadProfilePicture.middleware.js";
import a from "../utils/a.js";
import { uploadProfilePicture } from "../controllers/upload.controller.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";

const uploadRouter = Router();

uploadRouter.post(
  "/profile-picture",
  uploadProfilePictureMiddleware.single("file"),
  verifyTokenMiddleware("weak"),
  a(uploadProfilePicture)
);

uploadRouter.post(
  "/resume",
  uploadProfilePictureMiddleware.single("file"),
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  a(uploadProfilePicture)
);

export default uploadRouter;
