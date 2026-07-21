import { Router } from "express";
import { upload } from "../middlewares/upload.middleware.js";
import { requireAdmin, requireStaff, optionalAuth } from "../middlewares/auth.middleware.js";
import {
  getServices,
  getManicurists,
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
  getServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  getShiftTemplates,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
  getManicuristScheduleWeek,
  assignManicuristSchedule,
} from "../controllers/admin.controller.js";
import {
  getManicuristDashboard,
  completeAppointment,
  updateManicuristProfile,
} from "../controllers/manicurist.controller.js";
import { loginStaff } from "../controllers/auth.controller.js";
import { getLandingContent } from "../controllers/landing.controller.js";
import {
  listConversations,
  getConversationMessages,
  sendAdminReply,
  markConversationAsRead,
} from "../controllers/whatsapp-admin.controller.js";

const router = Router();

// Public routes
router.get("/services", getServices);
router.get("/manicurists", getManicurists);
router.get("/offers", getOffers);
router.get("/landing/content", getLandingContent);
router.post("/offers/validate", validateOfferCode);

router.post("/clients/auth", authClient);
router.post("/clients", createClient);
router.post("/auth/login", loginStaff);

router.post("/appointments", optionalAuth, createAppointment);
router.get("/appointments", optionalAuth, getClientAppointments);
router.get("/clients/:clientId/appointments", optionalAuth, getClientAppointments);
router.put("/appointments/:id", optionalAuth, updateAppointment);

// Admin routes (require auth)
router.get("/admin/stats", requireAdmin, getDashboardStats);
router.get("/admin/appointments", requireAdmin, getAllAppointments);
router.post("/admin/services", requireAdmin, createService);
router.put("/admin/services/:id", requireAdmin, updateService);
router.delete("/admin/services/:id", requireAdmin, deleteService);
router.get("/admin/categories", requireAdmin, getServiceCategories);
router.post("/admin/categories", requireAdmin, createServiceCategory);
router.patch("/admin/categories/:id", requireAdmin, updateServiceCategory);
router.delete("/admin/categories/:id", requireAdmin, deleteServiceCategory);
router.post("/admin/offers", requireAdmin, createSpecialOffer);
router.get("/admin/offers", requireAdmin, getAdminOffers);
router.put("/admin/offers/:id", requireAdmin, updateSpecialOffer);
router.delete("/admin/offers/:id", requireAdmin, deleteSpecialOffer);
router.get("/admin/clients", requireAdmin, getAdminUsers);
router.get("/admin/manicurists", requireAdmin, getAdminManicurists);
router.post("/admin/manicurists", requireAdmin, updateManicuristStatus);
router.put("/admin/manicurists/:id", requireAdmin, updateManicuristStatus);
router.post("/admin/landing-cms", requireAdmin, manageLandingContent);
router.delete("/admin/landing-cms/:id", requireAdmin, deleteLandingContent);
router.put("/admin/appointments/:id/status", requireAdmin, updateAppointmentStatus);
router.get("/admin/shift-templates", requireAdmin, getShiftTemplates);
router.post("/admin/shift-templates", requireAdmin, createShiftTemplate);
router.patch("/admin/shift-templates/:id", requireAdmin, updateShiftTemplate);
router.delete("/admin/shift-templates/:id", requireAdmin, deleteShiftTemplate);
router.get("/admin/manicurist-schedule", requireAdmin, getManicuristScheduleWeek);
router.put("/admin/manicurist-schedule", requireAdmin, assignManicuristSchedule);

// WhatsApp Admin routes
router.get("/admin/whatsapp/conversations", requireAdmin, listConversations);
router.get("/admin/whatsapp/conversations/:conversationId/messages", requireAdmin, getConversationMessages);
router.post("/admin/whatsapp/conversations/:conversationId/messages", requireAdmin, sendAdminReply);
router.patch("/admin/whatsapp/conversations/:conversationId/read", requireAdmin, markConversationAsRead);

router.post(
  "/admin/manicurists/upload-avatar",
  requireAdmin,
  upload.single("image"),
  uploadManicuristAvatar,
);

router.post(
  "/admin/landing/upload",
  requireAdmin,
  upload.single("image"),
  uploadLandingImage,
);

// Manicurist routes (require staff auth)
router.get("/manicurist/appointments", requireStaff, getManicuristDashboard);
router.put("/manicurist/profile", requireStaff, updateManicuristProfile);
router.put("/appointments/:id/complete", requireStaff, completeAppointment);

export default router;
