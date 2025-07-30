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
  retriveStripePaymentIntent,
} from "../services/stripe.service.js";
import FREELANCER from "../database/models/freelancer.model.js";
import TRANSACTION from "../database/models/transactions.model.js";
import Job from "../database/models/jobs.model.js";
import PlatformSettings from "../database/models/palteform.model.js";
import PENDING_PAYOUT from "../database/models/pendingPayout.model.js";
import EMPLOYER from "../database/models/employers.model.js";

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

    const totalAmount = offer.price;
    let companyCut = 0;
    if (plateform.pricing.platformCommissionPercentageActive === true) {
      companyCut = Math.round(
        totalAmount * (plateform.pricing.platformCommissionPercentage / 100)
      );
    }

    // create transaction
    const transaction = new TRANSACTION({
      mode: "order",
      orderDeatils: {
        freelancerId: offer.senderId,
        totalAmount: totalAmount,
        amountToBePaid: totalAmount - companyCut,
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
  //   const session = await mongoose.startSession();
  //   session.startTransaction();
  //   try {
  //     const userId = req.user?._id;
  //     const orderId = req.params.id;
  //     if (!mongoose.Types.ObjectId.isValid(orderId)) {
  //       return abortSessionWithMessage(res, session, "Invalid order ID");
  //     }
  //     if (!mongoose.Types.ObjectId.isValid(userId)) {
  //       return abortSessionWithMessage(res, session, "Invalid user ID");
  //     }
  //     const order = await Order.findById(orderId).session(session);
  //     if (!order) {
  //       return abortSessionWithMessage(res, session, "No order found!");
  //     }
  //     if (!order.employerId.equals(userId)) {
  //       return abortSessionWithMessage(
  //         res,
  //         session,
  //         "You are not authorized to complete this order"
  //       );
  //     }
  //     if (!["delivered", "in_progress"].includes(order.status)) {
  //       return abortSessionWithMessage(res, session, "Invalid order state");
  //     }
  //     if (order.status === "payment_pending") {
  //       return abortSessionWithMessage(
  //         res,
  //         session,
  //         "Payment pending for this order"
  //       );
  //     }
  //     // try {
  //     //   // ⚠️ Now release funds outside of DB transaction
  //     //   await getCapturedIntent(order.intentId);
  //     // } catch (err) {
  //     //   console.error("❌ Capture intent falied", err);
  //     //   return abortSessionWithMessage(
  //     //     res,
  //     //     session,
  //     //     "Unable to capture payment",
  //     //     500
  //     //   );
  //     // }
  //     await FREELANCER.updateOne(
  //       { _id: order.freelancerId },
  //       {
  //         $inc: {
  //           projectsCompleted: 1,
  //         },
  //       }
  //     ).session(session);
  //     order.status = "completed";
  //     await order.save({ session });
  //     await session.commitTransaction();
  //     session.endSession();
  //     return res.status(200).json({
  //       message: "Order marked as completed and funds released",
  //     });
  //   } catch (err) {
  //     console.error("❌ Order completion failed:", err);
  //     return abortSessionWithMessage(
  //       res,
  //       session,
  //       "Error marking order as completed"
  //     );
  //   }
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
      user: {
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

const getClientOrders = async (req, res) => {
  try {
    const clientId = req.user?._id;
    const clientModel = req.user?.role; // either "employer" or "job-seeker"

    if (
      !clientId ||
      !mongoose.Types.ObjectId.isValid(clientId) ||
      !["employer", "job-seeker"].includes(clientModel)
    ) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { status, fromDate, freelancerName } = req.query;

    // Build query
    const tempClientModel =
      clientModel == "employer"
        ? "employer"
        : clientModel == "job-seeker"
        ? "jobSeeker"
        : "";

    if (tempClientModel == "") {
      return res.status(400).json({ message: "Invalid Model" });
    }

    const filter = {
      employerId: clientId,
      employerModel: tempClientModel,
    };

    if (status) {
      filter.status = status;
    }

    if (fromDate) {
      const date = new Date(fromDate);
      if (!isNaN(date.getTime())) {
        filter.createdAt = { $gte: date };
      }
    }

    let orders = await Order.find(filter)
      .select(
        "status title totalAmount deadline createdAt deliveryDate completionDate cancelledDate freelancerId"
      )
      .populate({
        path: "freelancerId",
        select: "_id profilePictureUrl fullName",
      })
      .sort({ createdAt: -1 })
      .lean();

    // Optional filtering by freelancer name
    if (freelancerName) {
      const regex = new RegExp(freelancerName, "i");
      orders = orders.filter(
        (order) =>
          order.freelancerId?.fullName &&
          regex.test(order.freelancerId.fullName)
      );
    }

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
      user: {
        _id: order.freelancerId?._id?.toString() || "",
        profilePictureUrl: order.freelancerId?.profilePictureUrl || "",
        fullName: order.freelancerId?.fullName || "",
      },
    }));

    return res.status(200).json({ orders: formatted });
  } catch (err) {
    console.error("❌ Failed to fetch client orders:", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

const markOrderAsComplete = async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const orderId = req.params.id;
    const employerId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    const order = await Order.findOne({ _id: orderId, employerId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "completed") {
      return res.status(400).json({ message: "Order already completed" });
    }

    const transaction = await TRANSACTION.findById(order.transactionId);
    if (
      !transaction ||
      !transaction.orderDeatils ||
      !transaction.orderDeatils.stripeIntentId ||
      !transaction.orderDeatils.stripeSessionId
    ) {
      return res.status(404).json({ message: "Transaction not found" });
    }

    if (transaction.orderDeatils.status != "escrow_held") {
      return res
        .status(400)
        .json({ message: "No Payment Held for this order" });
    }

    // let paymentIntent;
    // try {
    //   paymentIntent = await retriveStripePaymentIntent(
    //     transaction.orderDeatils.stripeIntentId
    //   );
    // } catch (err) {
    //   return res
    //     .status(500)
    //     .json({ message: "Failed to retrieve Stripe payment intent" });
    // }

    // this amount is in cents
    // const totalAmount = paymentIntent.amount_received;

    // const plateform = (await PlatformSettings.find({}))[0];

    // let companyCut = 0;
    // if (plateform.pricing.platformCommissionPercentageActive === true) {
    //   companyCut = Math.round(
    //     totalAmount * (plateform.pricing.platformCommissionPercentage / 100)
    //   );
    // }
    // const freelancerAmount = totalAmount - companyCut;

    const freelancer = await FREELANCER.findById(order.freelancerId);
    if (!freelancer || !freelancer.stripeAccountId) {
      return res
        .status(404)
        .json({ message: "Freelancer or Stripe account not found" });
    }

    // Create a pending payout record (delay 7 days)
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() + 7);

    const pendingPayout = new PENDING_PAYOUT({
      freelancerId: freelancer._id,
      stripeAccountId: freelancer.stripeAccountId,
      amount: transaction.orderDeatils.amountToBePaid,
      transferGroup: `order_${order._id}`,
      releaseDate,
      orderId: order._id,
      transactionId: transaction._id,
    });

    // update paymet of freelancer
    freelancer.pendingClearence =
      freelancer.pendingClearence + transaction.orderDeatils.amountToBePaid;
    freelancer.projectsCompleted = freelancer.projectsCompleted + 1;
    await freelancer.save({ session: mongooseSession });

    //  Mark order complete
    order.status = "completed";
    order.completionDate = new Date();

    //  set status to paid
    // transaction.orderDeatils.status = "released_to_freelancer";
    // await transaction.save({ session: mongooseSession });

    // increment total orders for employer
    const employer = await EMPLOYER.findById(order.employerId);
    if (employer) {
      employer.ordersCompleted = employer.ordersCompleted + 1;
      await employer.save({ session: mongooseSession });
    }

    await pendingPayout.save({ session: mongooseSession });
    await order.save({ session: mongooseSession });

    await mongooseSession.commitTransaction();
    mongooseSession.endSession();

    return res.status(200).json({
      message: "Order marked as complete. Payout scheduled after 7 days.",
      success: true,
    });
  } catch (err) {
    console.error("❌ Error completing order:", err);
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    return res.status(500).json({ message: "Server Error" });
  }
};

const delieverOrderForRevsions = async (req, res) => {
  try {
    const orderId = req.params.id;
    const freelancerId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(freelancerId)) {
      return res.status(400).json({ message: "Invalid freelancerId ID" });
    }

    const freelancer = await FREELANCER.findById(freelancerId);
    if (!freelancer) {
      return res.status(404).json({ message: "Freelancer not found" });
    }

    const order = await Order.findOne({ _id: orderId, freelancerId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status != "in_progress") {
      return res
        .status(400)
        .json({ message: "Only In Progress orders can be delievered" });
    }

    order.status = "in_revision";
    await order.save();

    return res.status(200).json({
      message: "Order Pending for revesion",
      success: true,
    });
  } catch (err) {
    console.error("❌ Error updating order:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const markAsDelieverd = async (req, res) => {
  try {
    const orderId = req.params.id;
    const employerId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(employerId)) {
      return res.status(400).json({ message: "Invalid freelancerId ID" });
    }

    const order = await Order.findOne({ _id: orderId, employerId: employerId });
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status != "in_revision") {
      return res
        .status(400)
        .json({ message: "Only In Revision orders can be mrked " });
    }

    order.status = "delivered";
    await order.save();

    return res.status(200).json({
      message: "Order mark as delieverd ",
      success: true,
    });
  } catch (err) {
    console.error("❌ Error updating order:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Admin get recent orders
const getRecentOrders = async (req, res) => {
  try {
    const orders = await Order.find({})
      .sort({ updatedAt: -1 })
      .populate("freelancerId", "fullName")
      .limit(5);
    const transformedOrders = orders.map((e) => ({
      _id: e._id,
      freelancer: {
        _id: e.freelancerId._id,
        fullName: e.freelancerId.fullName,
      },
      createdAt: e.createdAt,
      status: e.status,
    }));

    return res.status(200).json({ orders: transformedOrders });
  } catch (err) {
    console.log("❌ Error getting recent orders");
    return res.status(500).json({ message: "Server Error" });
  }
};
export {
  createOrder,
  completeOrder,
  getFreelancerOrders,
  getClientOrders,
  markOrderAsComplete,
  delieverOrderForRevsions,
  markAsDelieverd,
  getRecentOrders
};
