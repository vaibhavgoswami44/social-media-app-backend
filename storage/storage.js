import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});

const postStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "posts",
    allowedFormats: ["jpeg", "png", "jpg"],
  },
});
const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "profile",
    allowedFormats: ["jpeg", "png", "jpg"],
  },
});

const deleteImage = async (public_id) => {
  try {
    const result = await cloudinary.uploader.destroy(public_id);
    return result;
  } catch (error) {
    console.error("Error deleting image:", error);
    throw error;
  }
};

const postUpload = multer({ storage: postStorage });
const profileUpload = multer({ storage: profileStorage });

export { postUpload, profileUpload, deleteImage };
