import { Router } from "express";
import roleBasedAuthMiddleware from "../middlewares/roleBasedAuth.middleware.js";
import {
  addEmployerProfile,
  editEmployerProfile,
  enableEmployerProfile,
  getAllEmployers,
  getEmployerProfile,
  getEmployerProfileById,
} from "../controllers/employer.controler.js";
import a from "../utils/a.js";

const EmployerRouter = Router();

EmployerRouter.get("/", a(getEmployerProfile));
EmployerRouter.get(
    "/all",
    roleBasedAuthMiddleware(["admin"]),
    a(getAllEmployers)
);
EmployerRouter.get("/:id", a(getEmployerProfileById));

EmployerRouter.post("/", a(addEmployerProfile));
EmployerRouter.post("/activate", a(enableEmployerProfile));

EmployerRouter.put("/", a(editEmployerProfile));

export default EmployerRouter;
