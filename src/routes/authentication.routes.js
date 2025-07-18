import { Router } from "express";

import uploadProfilePictureMiddleware from "../middlewares/uploadProfilePicture.middleware.js";
import a from "../utils/a.js";
const AuthenticationRouter = Router();
import {
  signUp,
  signIn,
  signOut,
  forgotPassword,
  resetPassword,
  createGoogleSignInLink,
  googleCallback,
} from "../controllers/authentication.controller.js";


AuthenticationRouter.post(
  "/signup",
  uploadProfilePictureMiddleware.single("file"),
  a(signUp)
);

AuthenticationRouter.get("/google", a(createGoogleSignInLink))
AuthenticationRouter.get("/google/callback", a(googleCallback))


AuthenticationRouter.post("/signin", a(signIn));
AuthenticationRouter.post("/signout", a(signOut));
AuthenticationRouter.post("/forgot-password", a(forgotPassword));
AuthenticationRouter.post("/reset-password", a(resetPassword));

export default AuthenticationRouter;
