import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const reviewSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true },

    employerId: {
      type: Types.ObjectId,
      refPath: "employerModel",
      required: true,
    },
    freelancerId: { type: Types.ObjectId, ref: "freelancer", required: true },
    employerModel: {
      type: String,
      required: true,
      enum: ["employer", "jobSeeker"],
    },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    comment: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We already have createdAt
  }
);

reviewSchema.index({ orderId: 1, freelancerId: 1 }, { unique: true });

const Review = model("Review", reviewSchema);
export default Review;
