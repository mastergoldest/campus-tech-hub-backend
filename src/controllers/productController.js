import mongoose from "mongoose";
import Product from "../models/Product.js";
import cloudinary from "../config/cloudinary.js";

const allowedCategories = [
  "Phones",
  "Electronics",
  "Computers",
  "Fashion",
  "Books & Education",
  "Accessories",
  "Other",
];

const allowedConditions = ["New", "Used"];

/**
 * Upload a file buffer to Cloudinary.
 */
function uploadToCloudinary(fileBuffer) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "campus-tech-hub/products",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        if (!result) {
          reject(new Error("Cloudinary did not return an upload result."));
          return;
        }

        resolve(result);
      },
    );

    uploadStream.end(fileBuffer);
  });
}

/**
 * POST /api/products
 * Create a product listing for the authenticated user.
 */
export const createProduct = async (req, res) => {
  let uploadedImagePublicId = "";

  try {
    const { name, price, category, condition, location, description } =
      req.body;

    const productName = typeof name === "string" ? name.trim() : "";

    const productLocation = typeof location === "string" ? location.trim() : "";

    const productDescription =
      typeof description === "string" ? description.trim() : "";

    const numericPrice = Number(price);

    if (productName.length < 2 || productName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Product name must contain between 2 and 100 characters.",
      });
    }

    if (
      price === undefined ||
      price === null ||
      price === "" ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid price greater than zero.",
      });
    }

    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid product category.",
      });
    }

    if (!allowedConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid product condition.",
      });
    }

    if (!productLocation || productLocation.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Enter a location of no more than 120 characters.",
      });
    }

    if (productDescription.length < 10 || productDescription.length > 1500) {
      return res.status(400).json({
        success: false,
        message: "Description must contain between 10 and 1500 characters.",
      });
    }

    if (!req.user?._id && !req.user?.id) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required to publish a product.",
      });
    }

    if (req.file && !process.env.CLOUDINARY_CLOUD_NAME) {
      return res.status(503).json({
        success: false,
        message: "Product image uploads are not configured on the server.",
      });
    }

    let image = {
      url: "",
      publicId: "",
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer);

      uploadedImagePublicId = uploadResult.public_id;

      image = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    }

    const product = await Product.create({
      name: productName,
      price: numericPrice,
      category,
      condition,
      seller: req.user._id || req.user.id,
      location: productLocation,
      description: productDescription,
      image,
    });

    const populatedProduct = await Product.findById(product._id)
      .populate("seller", "name email")
      .lean();

    return res.status(201).json({
      success: true,
      message: "Your product has been published successfully.",
      product: populatedProduct,
    });
  } catch (error) {
    // Avoid leaving an uploaded image behind if database creation fails.
    if (uploadedImagePublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedImagePublicId);
      } catch (cleanupError) {
        console.error("Failed to clean up product image:", cleanupError);
      }
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        success: false,
        message: "Please check the product information you submitted.",
        errors: Object.values(error.errors).map((item) => ({
          field: item.path,
          message: item.message,
        })),
      });
    }

    console.error("Create product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to publish your product at this time.",
    });
  }
};

/**
 * GET /api/products
 * Retrieve available products.
 */
export const getProducts = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 12),
    );

    const filter = {
      status: "available",
    };

    if (req.query.category) {
      if (!allowedCategories.includes(req.query.category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid product category.",
        });
      }

      filter.category = req.query.category;
    }

    if (req.query.search) {
      const search = String(req.query.search).trim();

      if (search.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Search query cannot exceed 100 characters.",
        });
      }

      if (search) {
        const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

        filter.$or = [
          { name: { $regex: escapedSearch, $options: "i" } },
          { description: { $regex: escapedSearch, $options: "i" } },
        ];
      }
    }

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate("seller", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      products,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve products at this time.",
    });
  }
};

/**
 * GET /api/products/mine
 * Retrieve listings belonging to the authenticated user.
 */
export const getMyProducts = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    const products = await Product.find({
      seller: userId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({
      success: true,
      products,
    });
  } catch (error) {
    console.error("Get my products error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your product listings.",
    });
  }
};

/**
 * DELETE /api/products/:id
 * Delete a product belonging to the authenticated user.
 */
export const deleteProduct = async (req, res) => {
  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    const product = await Product.findOne({
      _id: id,
      seller: userId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message:
          "Product not found or you do not have permission to delete it.",
      });
    }

    if (product.image?.publicId) {
      try {
        await cloudinary.uploader.destroy(product.image.publicId);
      } catch (imageError) {
        console.error(
          "Failed to delete product image from Cloudinary:",
          imageError,
        );
      }
    }

    await product.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Product deleted successfully.",
    });
  } catch (error) {
    console.error("Delete product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete the product at this time.",
    });
  }
};
/**
 * PUT /api/products/:id
 * Update a product belonging to the authenticated user.
 */
export const updateProduct = async (req, res) => {
  let uploadedImagePublicId = "";

  try {
    const userId = req.user?._id || req.user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication is required.",
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid product ID.",
      });
    }

    // Only the product owner can edit the listing.
    const product = await Product.findOne({
      _id: id,
      seller: userId,
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found or you do not have permission to edit it.",
      });
    }

    const { name, price, category, condition, location, description } =
      req.body;

    const productName = typeof name === "string" ? name.trim() : "";

    const productLocation = typeof location === "string" ? location.trim() : "";

    const productDescription =
      typeof description === "string" ? description.trim() : "";

    const numericPrice = Number(price);

    // Validate product name.
    if (productName.length < 2 || productName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Product name must contain between 2 and 100 characters.",
      });
    }

    // Validate price.
    if (
      price === undefined ||
      price === null ||
      price === "" ||
      !Number.isFinite(numericPrice) ||
      numericPrice <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid price greater than zero.",
      });
    }

    // Validate category.
    if (!allowedCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid product category.",
      });
    }

    // Validate condition.
    if (!allowedConditions.includes(condition)) {
      return res.status(400).json({
        success: false,
        message: "Please select a valid product condition.",
      });
    }

    // Validate location.
    if (!productLocation || productLocation.length > 120) {
      return res.status(400).json({
        success: false,
        message: "Enter a location of no more than 120 characters.",
      });
    }

    // Validate description.
    if (productDescription.length < 10 || productDescription.length > 1500) {
      return res.status(400).json({
        success: false,
        message: "Description must contain between 10 and 1500 characters.",
      });
    }

    // Prepare the new product information.
    product.name = productName;
    product.price = numericPrice;
    product.category = category;
    product.condition = condition;
    product.location = productLocation;
    product.description = productDescription;

    const oldImagePublicId = product.image?.publicId || "";

    // Replace the existing image only if a new image was uploaded.
    if (req.file) {
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        return res.status(503).json({
          success: false,
          message: "Product image uploads are not configured on the server.",
        });
      }

      const uploadResult = await uploadToCloudinary(req.file.buffer);

      uploadedImagePublicId = uploadResult.public_id;

      product.image = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
      };
    }

    // Save the updated product to MongoDB.
    await product.save();

    // Delete the old Cloudinary image only after the database save succeeds.
    if (
      uploadedImagePublicId &&
      oldImagePublicId &&
      oldImagePublicId !== uploadedImagePublicId
    ) {
      try {
        await cloudinary.uploader.destroy(oldImagePublicId);
      } catch (imageError) {
        console.error(
          "Failed to delete the previous product image:",
          imageError,
        );
      }
    }

    // Return the updated product with seller information.
    const updatedProduct = await Product.findById(product._id)
      .populate("seller", "name email phone")
      .lean();

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      product: updatedProduct,
    });
  } catch (error) {
    // Remove a newly uploaded image if the update fails.
    if (uploadedImagePublicId) {
      try {
        await cloudinary.uploader.destroy(uploadedImagePublicId);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up the new product image:",
          cleanupError,
        );
      }
    }

    if (error instanceof mongoose.Error.ValidationError) {
      return res.status(400).json({
        success: false,
        message: "Please check the product information you submitted.",
        errors: Object.values(error.errors).map((item) => ({
          field: item.path,
          message: item.message,
        })),
      });
    }

    console.error("Update product error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update the product at this time.",
    });
  }
};
