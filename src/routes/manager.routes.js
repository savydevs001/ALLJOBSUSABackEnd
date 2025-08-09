import { Router } from "express";
import a from "../utils/a.js";
import {
  createManagerAccount,
  loginManagerAccount,
} from "../controllers/manager.controller.js";

const ManagerRouter = Router();

ManagerRouter.post("/signup", a(createManagerAccount));
ManagerRouter.post("/signin", a(loginManagerAccount));

export default ManagerRouter;
