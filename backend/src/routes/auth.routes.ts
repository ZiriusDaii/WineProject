import { Router } from "express";
import { loginStaff } from "../controllers/auth.controller.js";

const router = Router();

router.post("/auth/login", loginStaff);

export default router;
