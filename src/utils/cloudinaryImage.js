import cloudinary from "../config/cloudinary.js";

/** Upload an image buffer to Cloudinary and return its upload result. */
export function uploadImageBuffer(buffer, folder) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    return Promise.reject(new Error("A valid image buffer is required."));
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          { quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Cloudinary returned an incomplete upload result."));
        }
        resolve(result);
      },
    );

    stream.end(buffer);
  });
}

/** Delete a Cloudinary image; an empty public ID is a no-op. */
export async function deleteCloudinaryImage(publicId) {
  if (!publicId) return null;
  return cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}
