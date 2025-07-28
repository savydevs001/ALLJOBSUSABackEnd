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
} from "../controllers/testimonial.controller.js";

const TestimonialRouter = new Router();

TestimonialRouter.get("/all", a(getAllTestimonials));

TestimonialRouter.get("/:id", a(getTestimonialById));

TestimonialRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(createTestimonial)
);

TestimonialRouter.put(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(updateTestimonial)
);

TestimonialRouter.delete(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin"]),
  a(deleteTestimonial)
);

export default TestimonialRouter;
