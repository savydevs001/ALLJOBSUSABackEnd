import { Router } from "express";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  suspendProfile,
  restoreProfile,
  deleteProfile,
  getUser,
  getUserById,
  getAllUsers,
  editUserProfile,
  onBoardUser,
  onBoardSuccess,
  generateStipeLogin,
} from "../controllers/user.controller.js";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";

const UserRouter = Router();

UserRouter.get("/onboard", verifyTokenMiddleware(), a(onBoardUser))
UserRouter.get("/onboarding-completed", verifyTokenMiddleware(), a(onBoardSuccess));
UserRouter.get("/stripe-login", verifyTokenMiddleware(), a(generateStipeLogin));
UserRouter.get(
  "/all",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(getAllUsers)
);
UserRouter.get("/", verifyTokenMiddleware(), a(getUser));
UserRouter.get("/:id", verifyTokenMiddleware(), a(getUserById));

UserRouter.put(
  "/suspend",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(suspendProfile)
);
UserRouter.put(
  "/restore",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(restoreProfile)
);
UserRouter.put("/", verifyTokenMiddleware(), a(editUserProfile));

UserRouter.delete(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(deleteProfile)
);

export default UserRouter;
