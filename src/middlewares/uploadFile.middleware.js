import multer from "multer";
import path from "path";
import fs from "fs";

const folder = "./src/public/uploads/";
const uploadDir = path.resolve(process.cwd(), folder);

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
  // Images
  "image/jpeg",
  "image/jpg",
  "image/png",

  // Archives
  "application/zip",
  "application/x-zip-compressed", // Windows-specific ZIP
  "multipart/x-zip", // Some other ZIP
  "application/x-rar-compressed",
  "application/vnd.rar", // Alternate RAR MIME

  // Documents
  "application/pdf",
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx

  // Videos
  "video/mp4", // Most common web format
  "video/quicktime", // .mov
  "video/x-msvideo", // .avi
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
