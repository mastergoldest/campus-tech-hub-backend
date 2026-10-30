
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must contain at least 2 characters"],
      maxlength: [80, "Name cannot exceed 80 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please provide a valid email address",
      ],
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must contain at least 8 characters"],
      select: false,
    },

    role: {
      type: String,
      enum: ["student", "technician", "admin"],
      default: "student",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    // Profile picture stored through Cloudinary.
    profilePicture: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },

    // Additional profile information.
    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: 20,
    },

    department: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    level: {
      type: String,
      trim: true,
      default: "",
      maxlength: 30,
    },

    bio: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    location: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    skills: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const User = mongoose.model("User", userSchema);

export default User;

