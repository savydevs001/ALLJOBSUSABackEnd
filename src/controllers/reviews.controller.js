// controllers/reviewController.js
import Review from "../database/models/reviews.model.js";
import Order from "../database/models/order.model.js";

import { z } from "zod";
import mongoose from "mongoose";
import abortSessionWithMessage from "../utils/abortSession.js";
import FREELANCER from "../database/models/freelancer.model.js";

// ZOD Schemas

const createReviewSchema = z.object({
  orderId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid order ID",
  }),
  freelancerId: z
    .string()
    .refine((val) => mongoose.Types.ObjectId.isValid(val), {
      message: "Invalid freelancer ID",
    }),
  rating: z
    .number()
    .min(1, "Rating must be at least 1")
    .max(5, "Rating must be at most 5"),
  comment: z.string().optional(),
});

const createReview = async (req, res) => {
  const data = createReviewSchema.parse(req.body);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const employerId = req.user?._id;
    const role = req.user.role;

    if (!["employer", "job-seeker"].includes(role)) {
      return res
        .status(403)
        .json({ message: "Only employers or job Seeker can post reviews" });
    }

    // Check if order exists and is completed
    const order = await Order.findById(data.orderId).session(session);
    if (!order || order.status !== "completed") {
      return abortSessionWithMessage(
        res,
        session,
        "Order not completed or does not exist"
      );
    }

    // Check if review already exists for this order from this user
    const existingReview = await Review.findOne({
      orderId: data.orderId,
      freelancerId: data.freelancerId,
    }).session(session);

    if (existingReview) {
      return abortSessionWithMessage(
        res,
        session,
        "You have already reviewed this order"
      );
    }

    const user = await FREELANCER.findById(data.freelancerId).session(session);

    if (!user) {
      return abortSessionWithMessage(
        res,
        session,
        "Freelancer does not exists",
        400
      );
    }

    const review = new Review({
      orderId: data.orderId,
      employerId: employerId,
      employerModel:
        role == "employer"
          ? "employer"
          : role == "job-seeker"
          ? "jobSeeker"
          : "",
      freelancerId: data.freelancerId,
      rating: data.rating,
      comment: data.comment,
    });

    // Update freelancer stats
    if (!user.rating || user.rating.isRated == false) {
      user.rating = {
        isRated: true,
        totalRatings: 1,
        totalRatingsSum: data.rating,
        value: data.rating,
      };
    } else {
      user.rating.totalRatings = user.rating.totalRatings + 1;
      user.rating.totalRatingsSum = user.rating.totalRatingsSum + data.rating;
      user.rating.value = Number(
        user.rating.totalRatingsSum / (user.rating.totalRatings || 1)
      );
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
