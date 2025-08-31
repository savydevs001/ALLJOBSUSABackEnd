import mongoose from "mongoose";

const subSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    fileUrl: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false }
);
const gallerySchema = new mongoose.Schema({
  gallery: { type: [subSchema], default: [] },
});

const GALLERY = mongoose.model("gallery", gallerySchema);
export default GALLERY;
