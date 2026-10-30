import express from "express";

import {
  getAdminStats,
  getAdminUsers,
  updateUserStatus,
  getAdminProducts,
  getAdminServices,
  updateAdminProduct,
  deleteAdminProduct,
  updateAdminService,
  deleteAdminService,
} from "../controllers/adminController.js";

import {
  protect,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// Every route in this file requires an authenticated administrator.
router.use(protect, authorize("admin"));

// Dashboard statistics
router.get("/stats", getAdminStats);

// User management
router.get("/users", getAdminUsers);
router.patch("/users/:id/status", updateUserStatus);

// Product management
router.get("/products", getAdminProducts);
router.patch("/products/:id", updateAdminProduct);
router.delete("/products/:id", deleteAdminProduct);

// Service management
router.get("/services", getAdminServices);
router.patch("/services/:id", updateAdminService);
router.delete("/services/:id", deleteAdminService);

export default router;