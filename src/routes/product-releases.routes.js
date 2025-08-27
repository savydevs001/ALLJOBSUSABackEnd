import { Router } from "express";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  createRelase,
  deleteRelease,
  editRelease,
  getAllReleases,
} from "../controllers/product-release.controller.js";

const ProductReleaseRouter = Router();

ProductReleaseRouter.get("/all", a(getAllReleases));

ProductReleaseRouter.post(
  "/",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(createRelase)
);


ProductReleaseRouter.put(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(editRelease)
);

ProductReleaseRouter.delete(
  "/:id",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["admin", "manager"]),
  a(deleteRelease)
);

export default ProductReleaseRouter;
