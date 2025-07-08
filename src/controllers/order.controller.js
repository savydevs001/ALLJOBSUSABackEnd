import mongoose from "mongoose";
import Order from "../database/models/order.model.js";
import Offer from "../database/models/offers.model.js";
import User from "../database/models/users.model.js";
import { z } from "zod";
import abortSessionWithMessage from "../utils/abortSession.js";
import { getCapturedIntent, relaseFunds } from "../services/stripe.service.js";

// Zod validation schema
const startOrderSchema = z.object({
  offerId: z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: "Invalid offer ID",
  }),
});

const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const employerId = req.user?._id;

    // Validate body
    const { offerId } = startOrderSchema.parse(req.body);

    // Check offer exists
    const offer = await Offer.findById(offerId).session(session);
    if (!offer || offer.status === "accepted") {
      return abortSessionWithMessage(res, session, "Offer not Valid", 400);
    } else {
      offer.status = "accepted";
      await offer.save({ session });
    }

    if (offer.receiverId.toString() != employerId.toString()) {
      return abortSessionWithMessage(
        res,
        session,
        "You are not allowed to accept this offerr",
        403
      );
    }

    // Prevent duplicate order for same offer
    const existingOrder = await Order.findOne({ offerId }).session(session);
    if (existingOrder) {
      return abortSessionWithMessage(
        res,
        session,
        "Order already exists for this offer",
        409
      );
    }

    // Create Order
    const order = new Order({
      offerId: offer._id,
      jobId: offer.jobId,
      employerId,
      freelancerId: offer.senderId,
      title: `Order for: ${offer.description?.substring(0, 50) || "Project"}`,
      description: offer.description,
      totalAmount: offer.proposedAmount,
      status: "payment_pending",
      paymentStatus: "payment_pending", // to be updated later when Stripe payment succeeds
      startDate: new Date(),
      milestones: offer.milestones || [],
    });
    await order.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    return abortSessionWithMessage(res, session, "Error creating order");
  }
};

const completeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = req.user?._id;
    const orderId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return abortSessionWithMessage(res, session, "Invalid order ID");
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return abortSessionWithMessage(res, session, "Invalid user ID");
    }

    const order = await Order.findById(orderId).session(session);

    if (!order) {
      return abortSessionWithMessage(res, session, "No order found!");
    }

    if (!order.employerId.equals(userId)) {
      return abortSessionWithMessage(
        res,
        session,
        "You are not authorized to complete this order"
      );
    }

    if (!["delivered", "in_progress"].includes(order.status)) {
      return abortSessionWithMessage(res, session, "Invalid order state");
    }

    if (order.paymentStatus === "payment_pending") {
      return abortSessionWithMessage(
        res,
        session,
        "Payment pending for this order"
      );
    }

    if (
      order.paymentStatus !== "payment_pending" &&
      order.paymentStatus !== "escrow_held"
    ) {
      return abortSessionWithMessage(res, session, "Order already fulfilled");
    }

    try {
      // ⚠️ Now release funds outside of DB transaction
      await getCapturedIntent(order.intentId);
    } catch (err) {
      console.error("❌ Capture intent falied", err);
      return abortSessionWithMessage(
        res,
        session,
        "Unable to capture payment",
        500
      );
    }

    await User.updateOne(
      { _id: order.freelancerId },
      {
        $inc: {
          "freelancerDetails.projectsCompleted": 1,
        },
      }
    ).session(session);

    order.status = "completed";
    order.paymentStatus = "released_to_freelancer";
    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Order marked as completed and funds released",
    });
  } catch (err) {
    console.error("❌ Order completion failed:", err);
    return abortSessionWithMessage(
      res,
      session,
      "Error marking order as completed"
    );
  }
};

export { createOrder, completeOrder };
