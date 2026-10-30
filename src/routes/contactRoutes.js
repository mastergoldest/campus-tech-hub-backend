import express from "express";
import rateLimit from "express-rate-limit";
import { sendContactMessage } from "../controllers/contactController.js";

const router = express.Router();

// Limit contact form submissions to 5 requests per 15 minutes.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 2,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message:
      "Too many messages have been submitted. Please try again after 15 minutes.",
  },
});

router.post("/", contactLimiter, sendContactMessage);

export default router;