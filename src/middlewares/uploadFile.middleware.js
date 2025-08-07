import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const folder = "src/public/uploads/";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, folder);

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    req.newName = "uploads/" + uniqueSuffix;
    cb(null, uniqueSuffix);
  },
});

const allowedTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "application/zip",
  "application/x-zip-compressed", // Windows-specific ZIP
  "multipart/x-zip",              // Some other ZIP
  "application/x-rar-compressed",
  "application/vnd.rar",          // Alternate RAR MIME
  "application/pdf",
  "application/msword",           // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
];


const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG and JPG, and compressd files allowed"), false);
  }
};

const uploadFileMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 25 * 1024 * 1024 },
});
export default uploadFileMiddleware;
