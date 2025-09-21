import path from "path";
import fs from "fs/promises"; // ✅ use promises API

const folder = "./src/public/uploads/";
const uploadDir = path.resolve(process.cwd(), folder);

(async () => {
  try {
    await fs.mkdir(uploadDir, { recursive: true });
  } catch (err) {
    console.error("❌ Error creating upload directory:", err);
  }
})();

const deleteFile = async (fileUrl) => {
  try {
    // ✅ Handle absolute or relative file URLs
    const filePath = path.resolve(uploadDir, path.basename(fileUrl));

    try {
      await fs.access(filePath); // check if file exists
    } catch {
      console.warn(`⚠️ File not found: ${filePath}`);
      return false;
    }

    await fs.unlink(filePath);
    console.log(`🗑️ Deleted file: ${filePath}`);
    return true;
  } catch (err) {
    console.error("❌ Error deleting file:", err);
    return false;
  }
};

export default deleteFile;
