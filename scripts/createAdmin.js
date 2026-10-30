import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import User from "../src/models/User.js";

dotenv.config();

const createAdmin = async () => {
  try {
    const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD, MONGO_URI } = process.env;

    if (!ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD || !MONGO_URI) {
      throw new Error("Required environment variables are missing.");
    }

    if (ADMIN_PASSWORD.length < 12) {
      throw new Error("Admin password must be at least 12 characters.");
    }

    await mongoose.connect(MONGO_URI);

    console.log("Connected to MongoDB.");

    const email = ADMIN_EMAIL.trim().toLowerCase();

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      if (existingUser.role === "admin") {
        console.log("An admin account with this email already exists.");
      } else {
        console.log(
          "This email belongs to an existing non-admin account. No changes were made.",
        );
      }

      return;
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 12);

    await User.create({
      name: ADMIN_NAME.trim(),
      email,
      password: hashedPassword,
      role: "admin",
      isActive: true,
    });

    console.log("Admin account created successfully!");
    console.log(`Admin email: ${email}`);
    console.log("You can now log in using the application's login page.");
  } catch (error) {
    console.error(
      "Admin creation failed:",
      error instanceof Error ? error.message : "Unknown error",
    );

    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

createAdmin();
