import express from "express";

import { protect } from "../middleware/authMiddleware.js";
import { uploadProfileImage } from "../middleware/uploadMiddleware.js";

import {
  getMyProfile,
  updateMyProfile,
  uploadMyProfilePicture,
} from "../controllers/userController.js";

const router = express.Router();

// Get the authenticated user's profile.
router.get("/me", protect, getMyProfile);

// Update ordinary profile fields.
router.patch("/me", protect, updateMyProfile);

// Upload or replace the authenticated user's profile picture.
router.patch(
  "/me/profile-picture",
  protect,
  uploadProfileImage,
  uploadMyProfilePicture,
);

export default router;