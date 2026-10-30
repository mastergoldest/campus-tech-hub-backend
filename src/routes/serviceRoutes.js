import express from "express";
import {
  createService,
  getServices,
  getMyServices,
  getServiceById,
  updateService,
  deleteService,
} from "../controllers/serviceController.js";

import { protect } from "../middleware/authMiddleware.js";
import { uploadProfileImage } from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getServices);

// Protected route: technician's own services
router.get("/mine", protect, getMyServices);

// Public route: individual service
router.get("/:id", getServiceById);

// Protected routes: create, update, delete
router.post("/", protect, uploadProfileImage, createService);
router.put("/:id", protect, uploadProfileImage, updateService);
router.delete("/:id", protect, deleteService);
export default router;
