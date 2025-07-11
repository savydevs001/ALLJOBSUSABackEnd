import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import uploadProfilePictureMiddleware from "../middlewares/uploadProfilePicture.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  getFreelancerProfile,
  creatFreelancerProfile,
  // addFreelanceProfile,
  // bookmarkFreelancer,
  // editFreelanceProfile,
  // enableFreelancerProfile,
  // getAllFreelancers,
  // getFreelancerProfileById,
  // unbookmarkFreelancer,
} from "../controllers/freelancer.controller.js";

const FreelancerRouter = Router();

// FreelancerRouter.get("/", a(getFreelancerProfile));
// FreelancerRouter.get("/all", a(getAllFreelancers));
// FreelancerRouter.get("/:id", a(getFreelancerProfileById));

// FreelancerRouter.post("/", a(addFreelanceProfile));
// FreelancerRouter.post(
//   "/activate",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["freelancer"]),
//   a(enableFreelancerProfile)
// );
// FreelancerRouter.post(
//   "/:id/bookmark",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["employer"]),
//   a(bookmarkFreelancer)
// );
// FreelancerRouter.post(
//   "/:id/remove-bookmark",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["employer"]),
//   a(unbookmarkFreelancer)
// );

// FreelancerRouter.put(
//   "/",
//   verifyTokenMiddleware(),
//   roleBasedAuthMiddleware(["freelancer"]),
//   a(editFreelanceProfile)
// );

FreelancerRouter.get("/", verifyTokenMiddleware(), a(getFreelancerProfile));

FreelancerRouter.post(
  "/create-profile",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["freelancer"]),
  uploadProfilePictureMiddleware.single("file"),
  a(creatFreelancerProfile)
);

export default FreelancerRouter;
