// models/Review.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const reviewSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true },

    reviewerId: { type: Types.ObjectId, ref: "User", required: true },
    revieweeId: { type: Types.ObjectId, ref: "User", required: true },

    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    comment: { type: String, required: true },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false, // We already have createdAt
  }
);

const Review = model("Review", reviewSchema);
export default Review;
