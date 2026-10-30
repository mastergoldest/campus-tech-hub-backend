import { z } from "zod";
import User from "../models/User.js";
import cloudinary from "../config/cloudinary.js";
import { Readable } from "node:stream";

const uploadBufferToCloudinary = (buffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-tech-hub/profiles",
        resource_type: "image",
        transformation: [
          {
            width: 600,
            height: 600,
            crop: "limit",
            quality: "auto",
            fetch_format: "auto",
          },
        ],
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result) {
          return reject(new Error("Cloudinary returned no upload result."));
        }

        resolve(result);
      },
    );

    Readable.from(buffer).pipe(uploadStream);
  });
};
// Fields safe to return to the frontend
const getPublicUser = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  bio: user.bio,
  location: user.location,
  skills: user.skills,
  profilePicture: user.profilePicture,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
  department: user.department,
  level: user.level,
});

// GET /api/users/me
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: getPublicUser(user),
    });
  } catch (error) {
    console.error("Get profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your profile.",
    });
  }
};

// PATCH /api/users/me
export const updateMyProfile = async (req, res) => {
  try {
    const profileSchema = z
      .object({
        name: z.string().trim().min(2).max(80).optional(),

        phone: z.string().trim().max(20).optional(),

        bio: z.string().trim().max(500).optional(),

        location: z.string().trim().max(120).optional(),

        skills: z.array(z.string().trim().min(1).max(60)).max(30).optional(),
        department: z.string().trim().max(120).optional(),

        level: z.string().trim().max(30).optional(),
      })
      .strict();

    const validation = profileSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile information.",
        errors: validation.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    if (Object.keys(validation.data).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one profile field to update.",
      });
    }

    // Only update explicitly permitted profile fields.
    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        $set: validation.data,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      user: getPublicUser(user),
    });
  } catch (error) {
    console.error("Update profile error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update your profile.",
    });
  }
};
export const uploadMyProfilePicture = async (req, res) => {
  let uploadedPublicId;

  try {
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      return res.status(503).json({
        success: false,
        message: "Image uploads are not configured on the server.",
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select an image to upload.",
      });
    }

    const user = await User.findById(req.user.id);

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: "User profile not found.",
      });
    }

    // Upload the new image first.
    const result = await uploadBufferToCloudinary(req.file.buffer);

    uploadedPublicId = result.public_id;

    // Save the Cloudinary URL and public ID in MongoDB.
    const oldPublicId = user.profilePicture?.publicId;

    user.profilePicture = {
      url: result.secure_url,
      publicId: result.public_id,
    };

    await user.save();

    // Delete the old image only after the database update succeeds.
    if (oldPublicId && oldPublicId !== result.public_id) {
      try {
        await cloudinary.uploader.destroy(oldPublicId, {
          resource_type: "image",
        });
      } catch (deleteError) {
        // A cleanup failure should not undo a successful profile update.
        console.error("Unable to delete previous profile image:", deleteError);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Profile picture uploaded successfully.",
      profilePicture: user.profilePicture,
    });
  } catch (error) {
    console.error("Profile picture upload error:", error);

    // If the upload succeeded but saving failed, remove the orphaned image.
    if (uploadedPublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedPublicId, {
          resource_type: "image",
        });
      } catch (cleanupError) {
        console.error("Unable to clean up uploaded image:", cleanupError);
      }
    }

    return res.status(500).json({
      success: false,
      message: "Unable to upload your profile picture.",
    });
  }
};
