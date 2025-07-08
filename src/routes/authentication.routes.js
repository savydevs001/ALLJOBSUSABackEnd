import { Router } from "express";

import a from "../utils/a.js";
const AuthenticationRouter = Router();
import {
  signUp,
  signIn,
  signOut,
  forgotPassword,
  resetPassword,
} from "../controllers/authentication.controller.js";

AuthenticationRouter.post("/signup", a(signUp));
AuthenticationRouter.post("/signin", a(signIn));
AuthenticationRouter.post("/signout", a(signOut));
AuthenticationRouter.post("/forgot-password", a(forgotPassword));
AuthenticationRouter.post("/reset-password", a(resetPassword));

export default AuthenticationRouter;
