import { Router } from "express";
import {
  getServices,
  getManicurists,
  getOffers,
  authClient,
  createClient,
  createAppointment,
} from "../controllers/client.controller.js";

const router = Router();

router.get("/services", getServices);
router.get("/manicurists", getManicurists);
router.get("/offers", getOffers);
router.post("/clients/auth", authClient);
router.post("/clients", createClient);
router.post("/appointments", createAppointment);

export default router;
