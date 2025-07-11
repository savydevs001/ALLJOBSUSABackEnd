import { uploadFile } from "./upload.js";

const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
const maxSize = 2 * 1024 * 1024;
async function uploadProfile(file) {
  try {
    if (!file || !file.buffer || !file.originalname) {
      throw new Error("Invalid file object");
    }

    if (!allowedTypes.includes(file.mimetype)) {
      return { message: "Invalid mimetype", path: null };
    }

    if (file.size > maxSize) {
      return { message: "Max 2Mb allowed", path: null };
    }

    const { path, message } = await uploadFile(file, "images/");
    return { path, message };
  } catch (err) {
    return { message: err.message, path: null };
  }
}

export default uploadProfile;
