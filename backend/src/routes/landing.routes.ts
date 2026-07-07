import { Router } from "express";
import { getLandingContent } from "../controllers/landing.controller.js";

const router = Router();

router.get("/landing/content", getLandingContent);

export default router;
