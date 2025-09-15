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
  verifyEmailToken,
  createAppleSignInLink,
  appleCallback,
} from "../controllers/authentication.controller.js";

AuthenticationRouter.get("/google", a(createGoogleSignInLink));
AuthenticationRouter.get("/google/callback", a(googleCallback));

AuthenticationRouter.get("/apple", a(createAppleSignInLink));
AuthenticationRouter.get("/apple/callback", a(appleCallback));

AuthenticationRouter.post(
  "/signup",
  uploadProfilePictureMiddleware.single("file"),
  a(signUp)
);

AuthenticationRouter.post("/signin", a(signIn));
AuthenticationRouter.post("/signout", a(signOut));
AuthenticationRouter.post("/forgot-password", a(forgotPassword));
AuthenticationRouter.post("/reset-password", a(resetPassword));
AuthenticationRouter.post("/verify-email", a(verifyEmailToken));

export default AuthenticationRouter;
