import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const testimonialSchema = new Schema(
  {
    profilePictureUrl: {
      type: String,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["published", "draft"],
      default: "draft",
    },
    role: {
      type: String,
      enum: ["freelancer", "jobSeeker", "employer"],
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    details: {
      type: String,
      required: true,
      trim: true,
    },
    createdBy: {
      type: Types.ObjectId,
      refPath: "role",
      required: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

const Testimonial = model("Testimonial", testimonialSchema);
export default Testimonial;
