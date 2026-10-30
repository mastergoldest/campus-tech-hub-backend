
import mongoose from "mongoose";
import Service from "../models/Service.js";
import {
  uploadImageBuffer,
  deleteCloudinaryImage,
} from "../utils/cloudinaryImage.js";

const SERVICE_CATEGORIES = [
  "Phone Repair",
  "Computer Repair",
  "Software & Web Development",
  "Graphics Design",
  "Networking",
  "Electronics",
  "Other",
];

const PRICING_MODELS = [
  "Fixed Price",
  "Hourly Rate",
  "Price on Request",
];

const CONTACT_METHODS = ["Phone", "Email", "WhatsApp"];

function getUserId(req) {
  return req.user?._id || req.user?.id;
}

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function validateServiceData(body, isUpdate = false) {
  const errors = [];

  const requiredFields = [
    "title",
    "category",
    "description",
    "pricingModel",
    "location",
    "contactMethod",
    "contactValue",
  ];

  if (!isUpdate) {
    for (const field of requiredFields) {
      if (
        body[field] === undefined ||
        body[field] === null ||
        String(body[field]).trim() === ""
      ) {
        errors.push(`${field} is required.`);
      }
    }
  }

  if (body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 100
    ) {
      errors.push("Title must contain 1–100 characters.");
    }
  }

  if (body.category !== undefined) {
    if (!SERVICE_CATEGORIES.includes(body.category)) {
      errors.push("Please select a valid service category.");
    }
  }

  if (body.description !== undefined) {
    if (
      typeof body.description !== "string" ||
      !body.description.trim() ||
      body.description.trim().length > 1500
    ) {
      errors.push("Description must contain 1–1500 characters.");
    }
  }

  if (body.pricingModel !== undefined) {
    if (!PRICING_MODELS.includes(body.pricingModel)) {
      errors.push("Please select a valid pricing model.");
    }
  }

  if (body.location !== undefined) {
    if (
      typeof body.location !== "string" ||
      !body.location.trim() ||
      body.location.trim().length > 150
    ) {
      errors.push("Location must contain 1–150 characters.");
    }
  }

  if (body.contactMethod !== undefined) {
    if (!CONTACT_METHODS.includes(body.contactMethod)) {
      errors.push("Please select a valid contact method.");
    }
  }

  if (body.contactValue !== undefined) {
    if (
      typeof body.contactValue !== "string" ||
      !body.contactValue.trim() ||
      body.contactValue.trim().length > 150
    ) {
      errors.push("Contact details must contain 1–150 characters.");
    }
  }

  const pricingModel = body.pricingModel;

  if (pricingModel === "Price on Request") {
    if (
      body.price !== undefined &&
      body.price !== null &&
      body.price !== ""
    ) {
      errors.push("Price must be empty for Price on Request.");
    }
  } else if (
    pricingModel !== undefined ||
    body.price !== undefined ||
    !isUpdate
  ) {
    if (
      pricingModel === undefined &&
      isUpdate &&
      body.price !== undefined
    ) {
      // The existing pricing model determines how the price is validated.
      // This case is handled in updateService using the existing service.
    } else {
      const price = Number(body.price);

      if (
        body.price === undefined ||
        body.price === null ||
        body.price === "" ||
        !Number.isFinite(price) ||
        price <= 0
      ) {
        errors.push("Price must be greater than zero.");
      }
    }
  }

  return errors;
}

function normalizeService(service) {
  const item = service.toObject ? service.toObject() : service;

  return {
    id: item._id.toString(),
    title: item.title,
    category: item.category,
    description: item.description,
    pricingModel: item.pricingModel,
    price: item.price ?? null,
    location: item.location,
    contactMethod: item.contactMethod,
    contactValue: item.contactValue,
    image: item.image?.url || "",
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    technician: item.technician,
  };
}

// CREATE SERVICE
export const createService = async (req, res) => {
  let uploadedImagePublicId = "";

  try {
    const technicianId = getUserId(req);

    if (!technicianId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can publish services.",
      });
    }

    const errors = validateServiceData(req.body);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please correct the service information.",
        errors,
      });
    }

    const {
      title,
      category,
      description,
      pricingModel,
      price,
      location,
      contactMethod,
      contactValue,
    } = req.body;

    let image = { url: "", publicId: "" };

    if (req.file) {
      const result = await uploadImageBuffer(
        req.file.buffer,
        "campus-tech-hub/services",
      );

      uploadedImagePublicId = result.public_id;

      image = {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }

    const service = await Service.create({
      title: title.trim(),
      category,
      description: description.trim(),
      pricingModel,
      price:
        pricingModel === "Price on Request" ? null : Number(price),
      location: location.trim(),
      contactMethod,
      contactValue: contactValue.trim(),
      image,
      technician: technicianId,
    });

    return res.status(201).json({
      success: true,
      message: "Service published successfully.",
      service: normalizeService(service),
    });
  } catch (error) {
    if (uploadedImagePublicId) {
      try {
        await deleteCloudinaryImage(uploadedImagePublicId);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up service image after creation failure:",
          cleanupError,
        );
      }
    }

    console.error("Create service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to publish service.",
    });
  }
};

// GET ALL SERVICES
export const getServices = async (req, res) => {
  try {
    const { category, search } = req.query;
    const filter = {};

    if (category && category !== "All Services") {
      if (!SERVICE_CATEGORIES.includes(category)) {
        return res.status(400).json({
          success: false,
          message: "Invalid service category.",
        });
      }

      filter.category = category;
    }

    if (search && String(search).trim()) {
      const escapedSearch = String(search)
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const searchRegex = new RegExp(escapedSearch, "i");

      filter.$or = [
        { title: searchRegex },
        { category: searchRegex },
        { description: searchRegex },
        { location: searchRegex },
      ];
    }

    const services = await Service.find(filter)
      .sort({ createdAt: -1 })
      .populate("technician", "name email");

    return res.status(200).json({
      success: true,
      count: services.length,
      services: services.map(normalizeService),
    });
  } catch (error) {
    console.error("Get services error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve services.",
    });
  }
};

// GET MY SERVICES
export const getMyServices = async (req, res) => {
  try {
    const technicianId = getUserId(req);

    if (!technicianId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    const services = await Service.find({
      technician: technicianId,
    }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: services.length,
      services: services.map(normalizeService),
    });
  } catch (error) {
    console.error("Get my services error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve your services.",
    });
  }
};

// GET ONE SERVICE
export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid service ID.",
      });
    }

    const service = await Service.findById(id).populate(
      "technician",
      "name email",
    );

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found.",
      });
    }

    return res.status(200).json({
      success: true,
      service: normalizeService(service),
    });
  } catch (error) {
    console.error("Get service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to retrieve service.",
    });
  }
};

// UPDATE MY SERVICE
export const updateService = async (req, res) => {
  let uploadedImagePublicId = "";

  try {
    const technicianId = getUserId(req);
    const { id } = req.params;

    if (!technicianId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can update services.",
      });
    }

    if (!isValidObjectId(id)) {
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

    if (service.technician.toString() !== technicianId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot update another technician's service.",
      });
    }

    const errors = validateServiceData(req.body, true);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Please correct the service information.",
        errors,
      });
    }

    const nextPricingModel =
      req.body.pricingModel ?? service.pricingModel;

    const nextPrice =
      req.body.price !== undefined
        ? req.body.price
        : service.price;

    if (nextPricingModel === "Price on Request") {
      if (
        req.body.price !== undefined &&
        req.body.price !== null &&
        req.body.price !== ""
      ) {
        return res.status(400).json({
          success: false,
          message: "Price must be empty for Price on Request.",
        });
      }

      service.price = null;
    } else if (
      req.body.price !== undefined ||
      req.body.pricingModel !== undefined
    ) {
      const parsedPrice = Number(nextPrice);

      if (
        nextPrice === null ||
        nextPrice === "" ||
        !Number.isFinite(parsedPrice) ||
        parsedPrice <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Price must be greater than zero.",
        });
      }

      service.price = parsedPrice;
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

    const oldImagePublicId = service.image?.publicId || "";

    if (req.file) {
      const result = await uploadImageBuffer(
        req.file.buffer,
        "campus-tech-hub/services",
      );

      uploadedImagePublicId = result.public_id;

      service.image = {
        url: result.secure_url,
        publicId: result.public_id,
      };
    }

    await service.save();

    // Only delete the old image after the database update succeeds.
    if (
      uploadedImagePublicId &&
      oldImagePublicId &&
      oldImagePublicId !== uploadedImagePublicId
    ) {
      try {
        await deleteCloudinaryImage(oldImagePublicId);
      } catch (cleanupError) {
        console.error(
          "Unable to delete previous service image:",
          cleanupError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Service updated successfully.",
      service: normalizeService(service),
    });
  } catch (error) {
    if (uploadedImagePublicId) {
      try {
        await deleteCloudinaryImage(uploadedImagePublicId);
      } catch (cleanupError) {
        console.error(
          "Failed to clean up replacement service image:",
          cleanupError,
        );
      }
    }

    console.error("Update service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to update service.",
    });
  }
};

// DELETE MY SERVICE
export const deleteService = async (req, res) => {
  try {
    const technicianId = getUserId(req);
    const { id } = req.params;

    if (!technicianId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required.",
      });
    }

    if (req.user.role !== "technician") {
      return res.status(403).json({
        success: false,
        message: "Only technicians can delete services.",
      });
    }

    if (!isValidObjectId(id)) {
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

    if (service.technician.toString() !== technicianId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete another technician's service.",
      });
    }

    const imagePublicId = service.image?.publicId || "";

    await service.deleteOne();

    // A failed image cleanup must not undo a successful listing deletion.
    if (imagePublicId) {
      try {
        await deleteCloudinaryImage(imagePublicId);
      } catch (cleanupError) {
        console.error(
          "Unable to delete service image from Cloudinary:",
          cleanupError,
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully.",
    });
  } catch (error) {
    console.error("Delete service error:", error);

    return res.status(500).json({
      success: false,
      message: "Unable to delete service.",
    });
  }
};

