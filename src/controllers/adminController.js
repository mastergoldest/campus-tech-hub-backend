import mongoose from "mongoose";
import User from "../models/User.js";
import Product from "../models/Product.js";
import Service from "../models/Service.js";
import cloudinary from "../config/cloudinary.js";
import {
  deleteCloudinaryImage,
} from "../utils/cloudinaryImage.js";

/**
 * ADMIN DASHBOARD STATISTICS
 * GET /api/admin/stats
 */
export const getAdminStats = async (req, res) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalTechnicians,
      totalProducts,
      totalServices,
      activeUsers,
      inactiveUsers,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "technician" }),
      Product.countDocuments(),
      Service.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: false }),
    ]);

    return res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalStudents,
        totalTechnicians,
        totalProducts,
        totalServices,
        activeUsers,
        inactiveUsers,
      },
    });
  } catch (error) {
    console.error("Admin statistics error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve dashboard statistics.",
    });
  }
};

/**
 * GET ALL USERS
 * GET /api/admin/users
 */
export const getAdminUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("-password")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error("Get admin users error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve users.",
    });
  }
};

/**
 * ACTIVATE OR DEACTIVATE A USER
 * PATCH /api/admin/users/:id/status
 */

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (typeof isActive !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "isActive must be true or false.",
      });
    }

    // Prevent an administrator from deactivating their own account.
    if (String(req.user.id) === String(id) && !isActive) {
      return res.status(400).json({
        success: false,
        message: "You cannot deactivate your own account.",
      });
    }

    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Prevent this endpoint from changing another administrator's status.
    if (targetUser.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Administrator accounts cannot be modified here.",
      });
    }

    targetUser.isActive = isActive;
    await targetUser.save();

    return res.status(200).json({
      success: true,
      message: `User ${isActive ? "activated" : "deactivated"} successfully.`,
      user: {
        id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
        isActive: targetUser.isActive,
      },
    });
  } catch (error) {
    console.error("Update user status error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to update user status.",
    });
  }
};


/**
 * GET ALL PRODUCTS FROM MONGODB
 * GET /api/admin/products
 */
export const getAdminProducts = async (req, res) => {
  try {
    const products = await Product.find()
      .populate("seller", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: products.length,
      products,
    });
  } catch (error) {
    console.error("Get admin products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve products.",
    });
  }
};

/**
 * GET ALL SERVICES FROM MONGODB
 * GET /api/admin/services
 */
export const getAdminServices = async (req, res) => {
  try {
    const services = await Service.find()
      .populate("technician", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: services.length,
      services,
    });
  } catch (error) {
    console.error("Get admin services error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve services.",
    });
  }
};

/**
 * EDIT A PRODUCT LISTING
 * PATCH /api/admin/products/:id
 *
 * Only supplied fields are updated.
 */
export const updateAdminProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const allowedFields = [
      "name",
      "description",
      "category",
      "condition",
      "location",
      "status",
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    if (req.body.price !== undefined) {
      const price = Number(req.body.price);

      if (!Number.isFinite(price) || price <= 0) {
        return res.status(400).json({
          success: false,
          message: "Price must be greater than zero.",
        });
      }

      updates.price = price;
    }

    if (
      updates.name !== undefined &&
      (updates.name.length < 2 || updates.name.length > 100)
    ) {
      return res.status(400).json({
        success: false,
        message: "Product name must contain 2–100 characters.",
      });
    }

    if (
      updates.description !== undefined &&
      (updates.description.length < 10 ||
        updates.description.length > 1500)
    ) {
      return res.status(400).json({
        success: false,
        message: "Description must contain 10–1500 characters.",
      });
    }

    const validCategories = [
      "Phones",
      "Electronics",
      "Computers",
      "Fashion",
      "Books & Education",
      "Accessories",
      "Other",
    ];

    if (
      updates.category !== undefined &&
      !validCategories.includes(updates.category)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product category.",
      });
    }

    if (
      updates.condition !== undefined &&
      !["New", "Used"].includes(updates.condition)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product condition.",
      });
    }

    if (
      updates.status !== undefined &&
      !["available", "sold"].includes(updates.status)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid product status.",
      });
    }

    if (
      updates.location !== undefined &&
      (!updates.location || updates.location.length > 120)
    ) {
      return res.status(400).json({
        success: false,
        message: "Location must contain 1–120 characters.",
      });
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Provide at least one valid field to update.",
      });
    }

    const product = await Product.findByIdAndUpdate(
      id,
      { $set: updates },
      {
        new: true,
        runValidators: true,
      },
    ).populate("seller", "name email");

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product,
    });
  } catch (error) {
    console.error("Admin update product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update the product.",
    });
  }
};

/**
 * DELETE A PRODUCT LISTING
 * DELETE /api/admin/products/:id
 */
export const deleteAdminProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found.",
      });
    }

    await product.deleteOne();

    if (product.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(product.image.publicId);
      } catch (imageError) {
        console.error(
          "Product deleted, but its Cloudinary image cleanup failed:",
          imageError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error("Admin delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete the product.",
    });
  }
};

/**
 * EDIT A SERVICE LISTING
 * PATCH /api/admin/services/:id
 */
export const updateAdminService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    const editableFields = [
      "title",
      "category",
      "description",
      "pricingModel",
      "location",
      "contactMethod",
      "contactValue",
    ];

    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        service[field] =
          typeof req.body[field] === "string"
            ? req.body[field].trim()
            : req.body[field];
      }
    }

    if (req.body.price !== undefined) {
      if (
        service.pricingModel === "Price on Request" &&
        req.body.price !== null &&
        req.body.price !== ""
      ) {
        return res.status(400).json({
          success: false,
          message: "Price must be empty for Price on Request.",
        });
      }

      if (service.pricingModel === "Price on Request") {
        service.price = null;
      } else {
        const price = Number(req.body.price);

        if (!Number.isFinite(price) || price <= 0) {
          return res.status(400).json({
            success: false,
            message: "Price must be greater than zero.",
          });
        }

        service.price = price;
      }
    } else if (service.pricingModel === "Price on Request") {
      service.price = null;
    }

    if (
      service.title.length < 1 ||
      service.title.length > 100 ||
      !service.description ||
      service.description.length > 1500 ||
      !service.location ||
      service.location.length > 150
    ) {
      return res.status(400).json({
        success: false,
        message: "Please check the service title, description, and location.",
      });
    }

    await service.save();

    const updatedService = await Service.findById(service._id)
      .populate("technician", "name email")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Service updated successfully.",
      service: updatedService,
    });
  } catch (error) {
    console.error("Admin update service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update the service.",
    });
  }
};

/**
 * DELETE A SERVICE LISTING
 * DELETE /api/admin/services/:id
 */
export const deleteAdminService = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Service.findById(id);

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    const imagePublicId = service.image?.publicId || "";

    await service.deleteOne();

    if (imagePublicId) {
      try {
        await deleteCloudinaryImage(imagePublicId);
      } catch (imageError) {
        console.error(
          "Service deleted, but its Cloudinary image cleanup failed:",
          imageError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    console.error("Admin delete service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete the service.",
    });
  }
};