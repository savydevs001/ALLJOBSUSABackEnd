import multer from "multer";
import path from "path";

const folder = "src/public/uploads/";
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
  "multipart/x-zip", // Some other ZIP
  "application/x-rar-compressed",
  "application/vnd.rar", // Alternate RAR MIME
  "application/pdf",
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
  limits: { fileSize: 10 * 1024 * 1024 },
});
export default uploadFileMiddleware;
