import mongoose from "mongoose";
const { Schema } = mongoose;

const relaseSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    product: { type: [String], required: true, default: [] },
  },
  {
    timestamps: true,
  }
);

const PRODUCT_RELEASE = mongoose.model("product-releases", relaseSchema);
export default PRODUCT_RELEASE;
