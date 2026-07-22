import { Router } from "express";
import { verifyWebhook, receiveMessage } from "../controllers/whatsapp.controller.js";

const router = Router();

router.get("/webhook", verifyWebhook);
router.post("/webhook", receiveMessage);

export default router;
