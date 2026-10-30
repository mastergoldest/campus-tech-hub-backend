import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Service title is required"],
      trim: true,
      maxlength: [100, "Service title cannot exceed 100 characters"],
    },

    category: {
      type: String,
      required: [true, "Service category is required"],
      enum: [
        "Phone Repair",
        "Computer Repair",
        "Software & Web Development",
        "Graphics Design",
        "Networking",
        "Electronics",
        "Other",
      ],
    },

    description: {
      type: String,
      required: [true, "Service description is required"],
      trim: true,
      maxlength: [1500, "Description cannot exceed 1500 characters"],
    },

    pricingModel: {
      type: String,
      required: [true, "Pricing model is required"],
      enum: [
        "Fixed Price",
        "Hourly Rate",
        "Price on Request",
      ],
    },

    price: {
      type: Number,
      default: null,
      min: [0.01, "Price must be greater than zero"],
      validate: {
        validator(value) {
          if (this.pricingModel === "Price on Request") {
            return value === null || value === undefined;
          }

          return typeof value === "number" && value > 0;
        },
        message: "A valid price is required for this pricing model",
      },
    },

    location: {
      type: String,
      required: [true, "Service location is required"],
      trim: true,
      maxlength: [150, "Location cannot exceed 150 characters"],
    },

    contactMethod: {
      type: String,
      required: [true, "Contact method is required"],
      enum: ["Phone", "Email", "WhatsApp"],
    },

    contactValue: {
      type: String,
      required: [true, "Contact details are required"],
      trim: true,
      maxlength: [150, "Contact details cannot exceed 150 characters"],
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

    technician: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

const Service = mongoose.model("Service", serviceSchema);

export default Service;