import { Router } from "express";
import { upload } from "../middlewares/upload.middleware.js";
import {
  getServices,
  getManicurists,
  getSedes,
  getOffers,
  validateOfferCode,
  authClient,
  createClient,
  createAppointment,
  updateAppointment,
  getClientAppointments,
  uploadManicuristAvatar,
  uploadLandingImage,
} from "../controllers/client.controller.js";
import {
  getDashboardStats,
  getAllAppointments,
  createService,
  createSpecialOffer,
  getAdminUsers,
  getAdminManicurists,
  updateManicuristStatus,
  manageLandingContent,
  deleteLandingContent,
  updateService,
  deleteService,
  updateSpecialOffer,
  deleteSpecialOffer,
  getAdminOffers,
  updateAppointmentStatus,
} from "../controllers/admin.controller.js";
import {
  getManicuristDashboard,
  completeAppointment,
  updateManicuristProfile,
} from "../controllers/manicurist.controller.js";
import { loginStaff } from "../controllers/auth.controller.js";
import { getLandingContent } from "../controllers/landing.controller.js";

const router = Router();

router.get("/services", getServices);
router.get("/sedes", getSedes);
router.get("/manicurists", getManicurists);
router.get("/offers", getOffers);

router.post("/clients/auth", authClient);
router.post("/clients", createClient);

router.post("/appointments", createAppointment);
router.get("/appointments", getClientAppointments);
router.get("/clients/:clientId/appointments", getClientAppointments);

router.get("/landing/content", getLandingContent);

router.post("/auth/login", loginStaff);

router.get("/admin/stats", getDashboardStats);
router.get("/admin/appointments", getAllAppointments);
router.post("/admin/services", createService);
router.put("/admin/services/:id", updateService);
router.delete("/admin/services/:id", deleteService);
router.post("/admin/offers", createSpecialOffer);
router.get("/admin/offers", getAdminOffers);
router.put("/admin/offers/:id", updateSpecialOffer);
router.delete("/admin/offers/:id", deleteSpecialOffer);
router.get("/admin/clients", getAdminUsers);
router.get("/admin/manicurists", getAdminManicurists);
router.post("/admin/manicurists", updateManicuristStatus);
router.put("/admin/manicurists/:id", updateManicuristStatus);
router.post("/admin/landing-cms", manageLandingContent);
router.delete("/admin/landing-cms/:id", deleteLandingContent);

router.post(
  "/admin/manicurists/upload-avatar",
  upload.single("image"),
  uploadManicuristAvatar,
);

router.post(
  "/admin/landing/upload",
  upload.single("image"),
  uploadLandingImage,
);

router.get("/manicurist/appointments", getManicuristDashboard);
router.put("/manicurist/profile", updateManicuristProfile);

router.put("/appointments/:id/complete", completeAppointment);
router.put("/appointments/:id", updateAppointment);
router.put("/admin/appointments/:id/status", updateAppointmentStatus);
router.post("/offers/validate", validateOfferCode);

export default router;
