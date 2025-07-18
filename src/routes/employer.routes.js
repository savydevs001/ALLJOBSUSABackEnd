import { Router } from "express";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import { getEmployerDashboardData } from "../controllers/employer.controler.js";
import a from "../utils/a.js";
import verifyTokenMiddleware from "../middlewares/verifyToken.middleware.js";

const EmployerRouter = Router();

EmployerRouter.get(
  "/dashboard",
  verifyTokenMiddleware(),
  roleBasedAuthMiddleware(["employer"]),
  a(getEmployerDashboardData)
);

// EmployerRouter.get("/", a(getEmployerProfile));
// EmployerRouter.get(
//     "/all",
//     roleBasedAuthMiddleware(["admin"]),
//     a(getAllEmployers)
// );
// EmployerRouter.get("/:id", a(getEmployerProfileById));

// EmployerRouter.post("/", a(addEmployerProfile));
// EmployerRouter.post("/activate", a(enableEmployerProfile));

// EmployerRouter.put("/", a(editEmployerProfile));

export default EmployerRouter;
