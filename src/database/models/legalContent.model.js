import mongoose from "mongoose";

const legalContentSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["privacy", "rules", "transparency", "cookies"],
    required: true,
    unique: true,
  },
  content: {
    type: String,
    required: true,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const LEGAL_CONTENT = mongoose.model("LegalContent", legalContentSchema);
export default LEGAL_CONTENT;
