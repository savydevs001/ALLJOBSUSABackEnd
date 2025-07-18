import fs from "fs/promises";
import path from "path";

const parentFolder = "src/public/";

const uploadFile = async (file, folderName = "un-specified") => {
  try {
    if (!file || !file.buffer || !file.originalname) {
      throw new Error("Invalid file object");
    }

    // Ensure the folder exists
    const uploadDir = parentFolder + folderName;
    await fs.mkdir(uploadDir, { recursive: true });

    // Construct a safe file path
    const ext = path.extname(file.originalname);
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    const filePath = path.join(uploadDir, uniqueSuffix);

    // Write the file buffer to disk
    await fs.writeFile(filePath, file.buffer);

    return {message: "ok", path: filePath};
  } catch (err) {
    return {message: err.message, path: null};
  }
};

export { uploadFile };
