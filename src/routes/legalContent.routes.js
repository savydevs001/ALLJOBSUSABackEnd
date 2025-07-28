import { Router } from "express";
import {
  getLegalContent,
  updateContent,
} from "../controllers/legalContent.controller.js";
import a from "../utils/a.js";

const LegalContentRouter = Router();

LegalContentRouter.get("/:type", a(getLegalContent));
LegalContentRouter.post("/:type", a(updateContent));

export default LegalContentRouter;
