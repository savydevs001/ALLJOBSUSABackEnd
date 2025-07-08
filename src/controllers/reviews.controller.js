// controllers/reviewController.js
import Review from "../database/models/reviews.model.js";
import Order from "../database/models/order.model.js";

import { z } from "zod";
import mongoose from "mongoose";
import User from "../database/models/users.model.js";
import abortSessionWithMessage from "../utils/abortSession.js";

// ZOD Schemas

const createReviewSchema = z.object({
  orderId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid order ID",
  }),
  revieweeId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid reviewee ID",
  }),
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z.string().min(1, "Comment is required"),
});

const createReview = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const reviewerId = req.user?._id;

    if (!req.user?.role.includes("employer")) {
      return res
        .status(403)
        .json({ message: "Only employers can post reviews" });
    }

    const data = createReviewSchema.parse(req.body);

    // Check if order exists and is completed
    const order = await Order.findById(data.orderId).session(session);
    if (!order || order.status !== "completed") {
      return abortSessionWithMessage(
        res,
        session,
        "Order not completed or does not exist"
      );
    }

    // Prevent reviewing oneself
    if (data.revieweeId === reviewerId.toString()) {
      return abortSessionWithMessage(
        res,
        session,
        "You cannot review yourself"
      );
    }

    // Check if review already exists for this order from this user
    const existingReview = await Review.findOne({
      orderId: data.orderId,
      reviewerId,
    }).session(session);

    if (existingReview) {
      return abortSessionWithMessage(
        res,
        session,
        "You have already reviewed this order"
      );
    }

    const user = await User.findOne({
      _id: data.revieweeId,
      role: { $in: ["freelancer"] },
    }).session(session);

    if (!user) {
      return abortSessionWithMessage(
        res,
        session,
        "Freelancer does not exists",
        400
      );
    }

    const review = new Review({
      ...data,
      reviewerId,
    });

    // Update freelancer stats
    if (!user.freelancerDetails) {
      user.freelancerDetails = {
        rating: review.rating,
        totalRatingSum: review.rating,
      };
    } else {
      user.freelancerDetails.totalRatingSum =
        (user.freelancerDetails.totalRatingSum || 0) + review.rating;

      user.freelancerDetails.rating =
        user.freelancerDetails.totalRatingSum /
        user.freelancerDetails.projectsCompleted;
    }

    await user.save({ session });
    await review.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Review created successfully",
      review,
    });
  } catch (err) {
    console.error("❌ Failed to create review:", err);
    return abortSessionWithMessage(res, session, "Server error", 500);
  }
};

export { createReview };
