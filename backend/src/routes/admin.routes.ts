import { Router } from "express";
import {
  getDashboardStats,
  getAllAppointments,
  createService,
  createSpecialOffer,
  getAdminUsers,
  getAdminManicurists,
  updateManicuristStatus,
  manageLandingContent,
} from "../controllers/admin.controller.js";
import {
  getManicuristDashboard,
  updateManicuristProfile,
} from "../controllers/manicurist.controller.js";

const router = Router();

router.get("/admin/stats", getDashboardStats);
router.get("/admin/appointments", getAllAppointments);
router.post("/admin/services", createService);
router.post("/admin/offers", createSpecialOffer);
router.get("/admin/clients", getAdminUsers);
router.get("/admin/manicurists", getAdminManicurists);
router.post("/admin/manicurists", updateManicuristStatus);
router.put("/admin/manicurists/:id", updateManicuristStatus);
router.post("/admin/landing-cms", manageLandingContent);

router.get("/manicurist/appointments", getManicuristDashboard);
router.put("/manicurist/profile", updateManicuristProfile);

export default router;
