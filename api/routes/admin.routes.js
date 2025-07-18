import { Router } from "express";
import {
  createAdminAccount,
  loginAdminAccount,
} from "../controllers/admin.controller.js";

const AdminRouter = Router();

// AdminRouter.post("/signup", createAdminAccount);
AdminRouter.post("/signin", loginAdminAccount);


export default AdminRouter
