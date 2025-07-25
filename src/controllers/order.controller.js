import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Order from "../database/models/order.model.js";
import Offer from "../database/models/offers.model.js";
import { z } from "zod";
import abortSessionWithMessage from "../utils/abortSession.js";
import {
  createCheckoutSession,
  genrateStripeCheckoutSession,
  getCapturedIntent,
  relaseFunds,
} from "../services/stripe.service.js";
import FREELANCER from "../database/models/freelancer.model.js";
import TRANSACTION from "../database/models/transactions.model.js";
import Job from "../database/models/jobs.model.js";

const FRONTEND_URL = process.env.FRONTEND_URL;

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
    const employerRole = req.user?.role;

    if (!["employer", "job-seeker"].includes(employerRole)) {
      return abortSessionWithMessage(
        res,
        session,
        "Invalid EMployer role",
        400
      );
    }

    // Validate body
    const { offerId } = startOrderSchema.parse(req.body);

    // Check offer exists
    const offer = await Offer.findById(offerId).session(session);
    if (!offer || offer.status === "accepted") {
      return abortSessionWithMessage(res, session, "Offer not Valid", 400);
    }
    //  else {
    //   offer.status = "accepted";
    //   await offer.save({ session });
    // }

    if (offer.receiverId.toString() != employerId.toString()) {
      return abortSessionWithMessage(
        res,
        session,
        "You are not allowed to accept this offerr",
        403
      );
    }

    // validate the freelancer
    const freelancer = await FREELANCER.findById(offer.senderId);
    if (!freelancer || freelancer.status != "active") {
      return abortSessionWithMessage(res, session, "Invalid Freelancer", 400);
    }

    // check job
    let job = null;
    if (offer.jobId) {
      job = await Job.findById(offer.jobId);
      if (!job || job.status != "empty") {
        return abortSessionWithMessage(
          res,
          session,
          "This job is not empty",
          400
        );
      }
      if (job.job != "freelance") {
        return abortSessionWithMessage(
          res,
          session,
          "This is not a freelance job",
          400
        );
      }
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

    // create transaction
    const transaction = new TRANSACTION({
      mode: "order",
      orderDeatils: {
        freelancerId: offer.senderId,
        totalAmount: offer.price,
      },
    });

    // Create Order
    const now = new Date();
    const order = new Order({
      offerId: offer._id,
      jobId: job ? job._id : null,
      employerId,
      employerModel:
        employerRole == "job-seeker"
          ? "jobSeeker"
          : employerRole == "employer"
          ? "employer"
          : "",
      freelancerId: offer.senderId,
      title: `${job ? job.title : offer.title ? offer.title : "Project"}`,
      description: job
        ? job.description
        : offer.description
        ? offer.description
        : "description",
      totalAmount: offer.price,
      status: "payment_pending",
      deadline: now.setDate(now.getDate() + offer.duration),
      milestones: offer.milestones || [],
      transactionId: transaction.id,
    });
    transaction.orderDeatils.orderId = order.id;

    let url = undefined;
    try {
      // create stripe payment ceckout
      const session = await createCheckoutSession({
        customerEmail: freelancer.email,
        name: job ? job.title : offer ? offer.title : "name not described",
        description: job
          ? job.description
          : offer
          ? offer.description
          : "description",
        amount: offer.price,
        successUrl:
          FRONTEND_URL +
          `/stripe/payment?session_id={CHECKOUT_SESSION_ID}&orderId=${order._id}`,
        cancelUrl: FRONTEND_URL + "/stripe/payment/failed",
        metadata: {
          purpose: "order-payment",
          orderId: order._id.toString(),
          jobId: job && job._id.toString(),
          offerId: offer._id.toString(),
          employerId: employerId.toString(),
          transactionId: transaction._id.toString(),
          freelancerId: freelancer._id.toString(),
        },
      });
      url = session.url;
    } catch (stripeErr) {
      console.log("Stripe error on order creation: ", stripeErr);
      return abortSessionWithMessage(
        res,
        session,
        "Error generating stripe checkout",
        500
      );
    }

    if (!url) {
      return abortSessionWithMessage(res, session, 500, "Server Error");
    }

    await order.save({ session });
    await transaction.save({ session });
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Order created successfully",
      orderId: order._id,
      url,
    });
  } catch (error) {
    console.log("❌Error creating order: ", error);
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

    if (order.status === "payment_pending") {
      return abortSessionWithMessage(
        res,
        session,
        "Payment pending for this order"
      );
    }

    // try {
    //   // ⚠️ Now release funds outside of DB transaction
    //   await getCapturedIntent(order.intentId);
    // } catch (err) {
    //   console.error("❌ Capture intent falied", err);
    //   return abortSessionWithMessage(
    //     res,
    //     session,
    //     "Unable to capture payment",
    //     500
    //   );
    // }

    await FREELANCER.updateOne(
      { _id: order.freelancerId },
      {
        $inc: {
          projectsCompleted: 1,
        },
      }
    ).session(session);

    order.status = "completed";
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

const getFreelancerOrders = async (req, res) => {
  try {
    const freelancerId = req.user?._id;
    if (!freelancerId || !mongoose.Types.ObjectId.isValid(freelancerId)) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, fromDate, clientName } = req.query;

    // Build the query
    const filter = { freelancerId };

    // 1. Filter by status if provided
    if (status) {
      filter.status = status;
    }

    // 2. Handle fromDate or period
    let dateFilter = null;

    if (fromDate) {
      const date = new Date(fromDate);
      if (!isNaN(date.getTime())) {
        dateFilter = date;
      }
    }

    if (dateFilter) {
      filter.createdAt = { $gte: dateFilter };
    }

    // 3. Fetch all matching orders
    let orders = await Order.find(filter)
      .select(
        "status title totalAmount deadline createdAt deliveryDate completionDate cancelledDate employerId employerModel"
      )
      .populate({
        path: "employerId",
        select: "_id profilePictureUrl fullName",
      })
      .sort({ createdAt: -1 }) // more accurate than "natural"
      .lean();

    // 4. Filter by client name if provided (after population)
    if (clientName) {
      const regex = new RegExp(clientName, "i");
      orders = orders.filter(
        (order) =>
          order.employerId?.fullName && regex.test(order.employerId.fullName)
      );
    }

    // 5. Format response
    const formatted = orders.map((order) => ({
      _id: order._id.toString(),
      status: order.status,
      title: order.title,
      price: order.totalAmount,
      deadline: order.deadline,
      deliveryDate: order.deliveryDate,
      completionDate: order.completionDate,
      cancelledDate: order.cancelledDate,
      createdAt: order.createdAt,
      employer: {
        _id: order.employerId?._id?.toString() || "",
        profilePictureUrl: order.employerId?.profilePictureUrl || "",
        fullName: order.employerId?.fullName || "",
      },
    }));

    return res.status(200).json({ orders: formatted });
  } catch (err) {
    console.error("❌ Failed to fetch freelancer orders:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export default getFreelancerOrders;

export { createOrder, completeOrder, getFreelancerOrders };
