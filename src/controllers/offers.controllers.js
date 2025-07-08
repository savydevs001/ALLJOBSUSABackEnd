// controllers/offerController.js
import req from "express/lib/request.js";
import Offer from "../database/models/offers.model.js";
import mongoose from "mongoose";
import { z } from "zod";
import abortSessionWithMessage from "../utils/abortSession.js";
import Order from "../database/models/order.model.js";
import Job from "../database/models/jobs.model.js";
import User from "../database/models/users.model.js";

// Zod schema
const milestoneSchema = z.object({
  name: z.string().min(1, "Milestone name is required"),
  dueDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid due date",
  }),
  amount: z.number().positive("Milestone amount must be greater than 0"),
});

const createOfferSchema = z.object({
  jobId: z
    .string("JobId is required")
    .refine((id) => mongoose.Types.ObjectId.isValid(id), {
      message: "Invalid jobId",
    }),
  receiverId: z.string().refine((id) => mongoose.Types.ObjectId.isValid(id), {
    message: "Invalid receiverId",
  }),
  proposedAmount: z.number().positive("Amount must be greater than 0"),
  description: z.string().min(1, "Description is required"),
  milestones: z.array(milestoneSchema).optional(),
});
const updateOfferSchema = z
  .object({
    proposedAmount: z.number().positive().optional(),
    description: z.string().min(1).optional(),
    milestones: z.array(milestoneSchema).optional(),
  })
  .strict(); // Prevent unexpected fields

const createOffer = async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findOne({
    _id: userId,
    status: "active",
  });
  if (!user.role.includes("freelancer")) {
    return res
      .status(403)
      .json({ message: "Offer can be created by freelancer only" });
  }

  if (!user.onboarded) {
    return res.status(400).json({ message: "Please setup payment first" });
  }

  const senderId = req.user?._id;
  const data = createOfferSchema.parse(req.body);

  const offer = new Offer({
    senderId,
    receiverId: data.receiverId,
    jobId: data.jobId,
    proposedAmount: data.proposedAmount,
    description: data.description,
    milestones: data.milestones || [],
  });

  await offer.save();

  return res.status(201).json({
    message: "Offer sent successfully",
    offer,
  });
};

const editOffer = async (req, res) => {
  const offerId = req.params.id;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).json({ message: "Invalid offer ID" });
  }

  // Parse and validate input
  const updates = updateOfferSchema.parse(req.body);

  // Find offer
  const offer = await Offer.findOne({ _id: offerId });

  if (!offer) {
    return res.status(404).json({ message: "Offer not found" });
  }

  // Only allow update if offer is still pending
  if (offer.status !== "pending") {
    return res
      .status(400)
      .json({ message: "Only pending offers can be updated" });
  }

  // Ensure only the sender (freelancer) can edit
  if (
    !req.user?.role.includes("freelancer") ||
    !offer.senderId.equals(req.user._id)
  ) {
    return res
      .status(403)
      .json({ message: "You are not authorized to update this offer" });
  }

  // Apply updates
  if (updates.proposedAmount !== undefined)
    offer.proposedAmount = updates.proposedAmount;
  if (updates.description !== undefined)
    offer.description = updates.description;
  if (updates.milestones !== undefined) offer.milestones = updates.milestones;

  await offer.save();

  return res.status(200).json({
    message: "Offer updated successfully",
    offer,
  });
};

const withdrawOffer = async (req, res) => {
  const offerId = req.params.id;

  // Validate offerId format
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).json({ message: "Invalid offer ID" });
  }

  const offer = await Offer.findById(offerId);

  if (!offer) {
    return res.status(404).json({ message: "Offer not found" });
  }

  // Only allow the sender to withdraw
  if (
    !req.user?.role.includes("freelancer") ||
    !offer.senderId.equals(req.user._id)
  ) {
    return res.status(403).json({
      message: "You are not authorized to withdraw this offer",
    });
  }

  if (offer.status === "withdrawn") {
    return res.status(400).json({ message: "Offer already withdrawn" });
  }

  // Only pending offers can be withdrawn
  if (offer.status !== "pending") {
    return res
      .status(400)
      .json({ message: "Only pending offers can be withdrawn" });
  }

  // Update offer status
  offer.status = "withdrawn";
  await offer.save();

  return res.status(200).json({
    message: "Offer withdrawn successfully",
    offer,
  });
};

const rejectOffer = async (req, res) => {
  const offerId = req.params.id;

  // Validate offer ID format
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).json({ message: "Invalid offer ID" });
  }

  const offer = await Offer.findById(offerId);

  if (!offer) {
    return res.status(404).json({ message: "Offer not found" });
  }

  // Only the receiver can reject the offer
  if (!offer.receiverId.equals(req.user._id)) {
    return res
      .status(403)
      .json({ message: "You are not authorized to reject this offer" });
  }

  if (offer.status === "rejected") {
    return res.status(400).json({ message: "Offer already rejected" });
  }

  // Ensure offer is still pending
  if (offer.status !== "pending") {
    return res
      .status(400)
      .json({ message: "Only pending offers can be rejected" });
  }

  // Update status to 'rejected'
  offer.status = "rejected";
  await offer.save();

  return res.status(200).json({
    message: "Offer rejected successfully",
    offer,
  });
};

const getOfferById = async (req, res) => {
  const offerId = req.params.id;

  // Validate ObjectId
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).json({ message: "Invalid offer ID" });
  }

  const offer = await Offer.findById(offerId)
    .populate("senderId", "profile")
    .populate("receiverId", "profile")
    .populate("jobId", "title description price status");

  // Optional access check (if you want only sender/receiver to view)
  if (
    (offer.senderId._id.equals(req.user?._id) &&
      offer.receiverId._id.equals(req.user?._id)) ||
    req.user?.role.includes("admin")
  ) {
    return res.status(200).json({ offer });
  }
  return res
    .status(403)
    .json({ message: "You are not authorized to view this offer" });
};

const ALLOWED_STATUSES = ["pending", "accepted", "rejected", "withdrawn"];
const getAllOffers = async (req, res) => {
  const { page = 1, limit = 10, senderId, receiverId, status } = req.query;
  const filters = {};

  // Validate and apply senderId filter
  if (senderId) {
    if (!mongoose.Types.ObjectId.isValid(senderId)) {
      return res.status(400).json({ message: "Invalid senderId" });
    }
    filters.senderId = senderId;
  }

  // Validate and apply receiverId filter
  if (receiverId) {
    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ message: "Invalid receiverId" });
    }
    filters.receiverId = receiverId;
  }

  // Validate and apply status filter
  if (status) {
    if (!ALLOWED_STATUSES.includes(status)) {
      return res.status(400).json({ message: "Invalid offer status" });
    }
    filters.status = status;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await Offer.countDocuments(filters);

  const offers = await Offer.find(filters)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select("-milestones");

  if (!offers) {
    return res.status(404).json({ message: "offers not found" });
  }

  return res.status(200).json({
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    results: offers.length,
    offers,
  });
};

const acceptOffer = async (req, res) => {
  const offerId = req.params.id;

  // Validate offer ID format
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).json({ message: "Invalid offer ID" });
  }

  const session = await mongoose.startSession();
  try {
    const offer = await Offer.findById(offerId).session(session);

    if (!offer) {
      return abortSessionWithMessage(res, session, "Offer not found!", 404);
    }

    // Only the receiver can reject the offer
    if (!offer.receiverId.equals(req.user._id)) {
      return abortSessionWithMessage(
        res,
        session,
        "You are not authorized to reject this offer",
        403
      );
    }

    if (offer.status === "accepted") {
      return abortSessionWithMessage(
        res,
        session,
        "Offer already accepted",
        400
      );
    }

    // Ensure offer is still pending
    if (offer.status !== "pending") {
      return abortSessionWithMessage(
        res,
        session,
        "Only pending offers can be accepted",
        400
      );
    }

    offer.status = "accepted";
    await offer.save({ session });

    const job = await Job.findByIdAndUpdate(offer.jobId).session(session);
    if (!job) {
      return abortSessionWithMessage(
        res,
        session,
        "No matching Job found",
        404
      );
    }

    if (job.status === "filled") {
      return abortSessionWithMessage(res, session, "Job already filled", 403);
    }

    if (job.status === "expired") {
      return abortSessionWithMessage(res, session, "Job expired", 403);
    }

    job.status = "filled";
    await job.save({ session });

    // create order
    const order = new Order({
      offerId: offer._id,
      jobId: offer.jobId,
      employerId: offer.receiverId,
      freelancerId: offer.senderId,
      title: job.title,
      description: job.description,
      totalAmount: offer.proposedAmount,
    });

    await order.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Offer accepted successfully",
      order_id: order._id,
    });
  } catch (err) {
    console.error("❌ Failed to Accept offer:", err);
    return abortSessionWithMessage(res, session, "Server error", 500);
  }
};

export {
  createOffer,
  editOffer,
  withdrawOffer,
  rejectOffer,
  getOfferById,
  getAllOffers,
  acceptOffer,
};
