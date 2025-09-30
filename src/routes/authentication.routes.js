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
  MobileGoogleSignin,
  firbase_FCM_Token,
  MobileAppleSignIn,
  removeAccount,
} from "../controllers/authentication.controller.js";

AuthenticationRouter.get("/google", a(createGoogleSignInLink));
AuthenticationRouter.get("/google/callback", a(googleCallback));

AuthenticationRouter.get("/apple", a(createAppleSignInLink));
AuthenticationRouter.post("/apple/callback", a(appleCallback));
AuthenticationRouter.post("/google-mobile", a(MobileGoogleSignin))
AuthenticationRouter.post("/apple-mobile", a(MobileAppleSignIn))
AuthenticationRouter.post("/fcm-token", a(firbase_FCM_Token))


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
AuthenticationRouter.post("/remove-account", a(removeAccount))

export default AuthenticationRouter;
