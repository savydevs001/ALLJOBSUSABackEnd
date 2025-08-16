import fs from "fs";
import path from "path";
import dotenv from "dotenv"
dotenv.config()

const folder = "./src/public/uploads/";
const uploadDir = path.resolve(process.cwd(), folder);
const BACKEND_URL = process.env.BACKEND_URL

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadPdfBufferToStorage = async (buffer) => {
  try {
    // Construct a safe file path
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + ".pdf";
    const filePath = path.join(uploadDir, uniqueSuffix);

    // Write the file buffer to disk
    fs.writeFile(filePath, buffer, (err) => {
      if (err) {
        console.log("Error savinf pdf: ", err);
      }
    });

    return { message: "ok", path: BACKEND_URL + "/uploads/" + uniqueSuffix };
  } catch (err) {
    console.log("Error uploadig file to storage: ", err);
    return { message: err.message, path: null };
  }
};

export default uploadPdfBufferToStorage;
