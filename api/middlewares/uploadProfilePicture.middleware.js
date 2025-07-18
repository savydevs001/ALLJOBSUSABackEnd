import multer from "multer";
import path from "path";

const folder = "src/public/images/";
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    req.folder = "images/";
    cb(null, folder);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix =
      Date.now() + "-" + Math.round(Math.random() * 1e9) + ext;
    req.newName = req.folder + uniqueSuffix;
    cb(null, uniqueSuffix);
  },
});

const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

const fileFilter = (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Only JPEG, PNG and JPG files are allowed"), false);
  }
};

const uploadProfilePictureMiddleware = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});
export default uploadProfilePictureMiddleware;
