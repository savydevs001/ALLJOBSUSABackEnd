import { Router } from "express";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import a from "../utils/a.js";
import {
  createTestimonial,
  deleteTestimonial,
  getAllTestimonials,
  getTestimonialById,
  updateTestimonial,
  userCreateTestimonial,
} from "../controllers/testimonial.controller.js";

const TestimonialRouter = new Router();

TestimonialRouter.get("/all",verifyTokenMiddleware("weak") ,a(getAllTestimonials));

TestimonialRouter.get("/:id", a(getTestimonialById));

TestimonialRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(createTestimonial)
);

TestimonialRouter.post(
  "/user-posting",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer", "job-seeker", "freelancer"]),
  a(userCreateTestimonial)
);

TestimonialRouter.put(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(updateTestimonial)
);

TestimonialRouter.delete(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(deleteTestimonial)
);

export default TestimonialRouter;
