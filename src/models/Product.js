import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must contain at least 2 characters"],
      maxlength: [100, "Product name cannot exceed 100 characters"],
    },

    price: {
      type: Number,
      required: [true, "Product price is required"],
      min: [1, "Product price must be greater than zero"],
    },

    category: {
      type: String,
      required: [true, "Product category is required"],
      enum: [
        "Phones",
        "Electronics",
        "Computers",
        "Fashion",
        "Books & Education",
        "Accessories",
        "Other",
      ],
    },

    condition: {
      type: String,
      enum: ["New", "Used"],
      default: "Used",
      required: true,
    },

    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    location: {
      type: String,
      required: [true, "Product location is required"],
      trim: true,
      maxlength: [120, "Location cannot exceed 120 characters"],
    },

    description: {
      type: String,
      required: [true, "Product description is required"],
      trim: true,
      minlength: [10, "Description must contain at least 10 characters"],
      maxlength: [1500, "Description cannot exceed 1500 characters"],
    },

    image: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },

    status: {
      type: String,
      enum: ["available", "sold"],
      default: "available",
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

productSchema.index({ createdAt: -1 });

const Product = mongoose.model("Product", productSchema);

export default Product;