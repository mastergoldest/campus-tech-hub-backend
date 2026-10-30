import express from "express";

import { protect } from "../middleware/authMiddleware.js";

import { uploadProfileImage } from "../middleware/uploadMiddleware.js";

import {
  createProduct,
  getMyProducts,
  getProducts,
  deleteProduct,
  updateProduct,
} from "../controllers/productController.js";

const router = express.Router();

// Public: browse available products.
router.get("/", getProducts);

// Protected: retrieve the authenticated user's listings.
router.get("/mine", protect, getMyProducts);

// Protected: publish a new product.
router.post("/", protect, uploadProfileImage, createProduct);

// Protected: update an existing product.
router.put("/:id", protect, uploadProfileImage, updateProduct);

// Protected: delete an existing product.
router.delete("/:id", protect, deleteProduct);

export default router;