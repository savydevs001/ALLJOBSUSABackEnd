// controllers/offerController.js
import req from "express/lib/request.js";
import Offer from "../database/models/offers.model.js";
import mongoose from "mongoose";
import { z } from "zod";
import abortSessionWithMessage from "../utils/abortSession.js";
import Order from "../database/models/order.model.js";
import Job from "../database/models/jobs.model.js";
import User from "../database/models/users.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import sendEmail from "../services/emailSender.js";
import enqueueEmail from "../services/emailSender.js";

function getTotalYearsWorkedWithMerging(employers) {
  if (!Array.isArray(employers)) return 0;

  // Convert and sort by startDate
  const ranges = employers
    .map(({ startDate, endDate }) => ({
      start: new Date(startDate),
      end: new Date(endDate),
    }))
    .filter(({ start, end }) => !isNaN(start) && !isNaN(end) && end > start)
    .sort((a, b) => a.start - b.start);

  if (ranges.length === 0) return 0;

  const merged = [ranges[0]];

  for (let i = 1; i < ranges.length; i++) {
    const last = merged[merged.length - 1];
    const current = ranges[i];

    // If overlapping or contiguous
    if (current.start <= last.end) {
      last.end = new Date(Math.max(last.end, current.end));
    } else {
      merged.push(current);
    }
  }

  const totalMilliseconds = merged.reduce(
    (sum, { start, end }) => sum + (end - start),
    0
  );
  const millisecondsPerYear = 1000 * 60 * 60 * 24 * 365.25;

  return parseFloat((totalMilliseconds / millisecondsPerYear).toFixed(0));
}

// Create Offer
const milestoneSchema = z.object({
  name: z.string().min(1, "Milestone name is required"),
  dueDate: z.string().refine((date) => !isNaN(Date.parse(date)), {
    message: "Invalid due date",
  }),
  amount: z.number().positive("Milestone amount must be greater than 0"),
});
const createOfferSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  duration: z.number().positive("Duration must be greater than 0"),
  price: z.number().positive("Amount must be greater than 0"),
  milestones: z.array(milestoneSchema).optional(),
});
const createOffer = async (req, res, next) => {
  const data = createOfferSchema.parse(req.body);
  try {
    const jobId = req.params.id;
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid Job id" });
    }

    // user validation
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User id" });
    }
    const user = await FREELANCER.findById(userId);
    if (!user || user.status == "deleted") {
      return res.status(400).json({ message: "User not found!" });
    }
    if (user.status == "suspended") {
      return res
        .status(400)
        .json({ message: "Suspeneded User cannot create Offer" });
    }

    // Job validation
    const job = await Job.findById(jobId).populate("employerId", "fullName");
    // .lean();

    if (!job) {
      return res.status(404).json({ message: "Job not found!" });
    }

    if (job.status == "expired" || job.deadline < new Date()) {
      return res.status(400).json({ message: "Job Expired" });
    }

    if (job.job === "freelance") {
      if (!user.onboarded) {
        return res
          .status(200)
          .json({ message: "User need to be onbarded", onBoardRequired: true });
      }
    }

    // check if offer exists
    const existingOffer = await Offer.findOne({
      senderId: userId,
      jobId: job._id,
    });
    if (existingOffer) {
      return res.status(400).json({
        message: "You have already made offer to this Job",
        offer_id: existingOffer._id,
      });
    }

    // employer validation
    const employer = await EMPLOYER.findById(job.employerId);
    if (!employer) {
      return res.status(404).json({ message: "Invalid Employer" });
    }
    if (employer.status != "active") {
      return res
        .status(400)
        .json({ message: "Employer Account suspended or deleted" });
    }

    // check if employer and freelancer are same
    if (employer.email == user.email) {
      return res
        .status(400)
        .json({ message: "Offer recipent and sender could not be same" });
    }

    // create transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // create offer
      const offer = new Offer({
        senderId: userId,
        receiverId: job.employerId,
        jobId: job._id,
        duration: data.duration,
        price: data.price,
        title: data.title,
        description: data.description,
        milestones: data.milestones || [],
      });

      if (job.applicants && job.applicants.length > 0) {
        job.applicants = [...job.applicants, user._id];
      } else {
        job.applicants = [user._id];
      }

      // Add to recent activity
      user.activity.unshift({
        title: "Applied to " + job.title,
        subTitle: job.employerId.fullName,
        at: new Date(),
      });
      if (user.activity.length > 3) {
        user.activity.splice(3);
      }
      user.profile.jobActivity.applicationsSent =
        (user.profile?.jobActivity?.applicationsSent || 0) + 1;

      await offer.save({ session });
      await job.save({ session });
      await user.save({ session });

      await session.commitTransaction();
      session.endSession();

      return res
        .status(200)
        .json({ message: "Offer creted successfully", offer_id: offer._id });
    } catch (err) {
      console.log("❌ Error creating Offer: ", err);
      abortSessionWithMessage(res, session, "Server Error", 400);
    }
  } catch (err) {
    console.log("❌ Error creating Offer: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getUserOffers = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const offers = await Offer.find({ senderId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "_id jobId senderId receiverId title description price duration status interviewDetails acceptedAt createdAt"
      )
      .populate("receiverId", "fullName")
      .lean();

    return res.status(200).json({
      offers,
    });
  } catch (err) {
    console.log("❌ Error creating Offer: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Received Offers
const getReceivedOffers = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const text = req.query.text?.trim();
    const status = req.query.status?.trim();
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const textTerms = text
      ? text
          .split(" ")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const initialFilter = { receiverId: new mongoose.Types.ObjectId(userId) };
    if (status != "") {
      initialFilter.status = status;
    }

    const matchStages = [
      {
        ...initialFilter,
      },
    ];

    if (textTerms.length > 0) {
      const orConditions = textTerms.map((term) => {
        const regex = new RegExp(term, "i");
        return {
          $or: [
            { title: { $regex: regex } },
            { description: { $regex: regex } },
            { "sender.fullName": { $regex: regex } },
          ],
        };
      });
      matchStages.push(...orConditions);
    }

    const offers = await Offer.aggregate([
      {
        $lookup: {
          from: "freelancers",
          localField: "senderId",
          foreignField: "_id",
          as: "sender",
        },
      },
      { $unwind: "$sender" },
      { $match: { $and: matchStages } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          jobId: 1,
          title: 1,
          status: 1,
          createdAt: 1,
          sender: {
            _id: "$sender._id",
            fullName: "$sender.fullName",
            profilePictureUrl: {
              $ifNull: ["$sender.profilePictureUrl", ""],
            },
            title: "$sender.profile.professionalTitle",
            resumeUrl: {
              $ifNull: ["$sender.profile.resumeUrl", ""],
            },
            rating: {
              $cond: [
                "$sender.rating.isRated",
                "$sender.rating.value",
                "not rated",
              ],
            },
            experiences: "$sender.profile.experiences",
          },
        },
      },
    ]);

    const transformedOffers = offers.map((e) => {
      const yearsOfExperience = getTotalYearsWorkedWithMerging(
        e.sender.experiences || []
      );

      return {
        _id: e._id,
        jobId: e.jobId,
        appliedTo: e.title,
        status: e.status,
        createdAt: e.createdAt,
        sender: {
          _id: e.sender._id,
          fullName: e.sender.fullName,
          profilePictureUrl: e.sender.profilePictureUrl || "",
          title: e.sender.title || "",
          resumeUrl: e.sender.resumeUrl || "",
          rating: e.sender.rating,
          yearsOfExperience,
        },
      };
    });

    return res.status(200).json({ offers: transformedOffers });
  } catch (err) {
    console.error("❌ Error retrieving received offers:", err);
    return res
      .status(500)
      .json({ message: "Error retrieving received offers" });
  }
};

// Get offer by id;
const getOfferById = async (req, res) => {
  const offerId = req.params?.id;
  const userId = req.user?._id;
  try {
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "User not found" });
    }

    if (!offerId || !mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(404).json({ message: "Offer not found" });
    }

    const offer = await Offer.findById(offerId)
      .populate(
        "senderId",
        "_id fullName email profilePictureUrl profile.resumeUrl profile.professionalTitle profile.experiences  rating"
      )
      .populate(
        "jobId",
        "_id, title description job status simpleJobDetails.locationState simpleJobDetails.locationCity deadline simpleJobDetails.experienceLevel freelanceJobDetails.experienceLevel applicants simpleJobDetails.minSalary simpleJobDetails.maxSalary freelanceJobDetails.budget"
      );

    if (!offer) {
      return res.status(404).json({ message: "No Offer found" });
    }

    if (!req.user || res.user?.role != "admin") {
      if (
        ![
          offer.senderId._id.toString(),
          offer.receiverId._id.toString(),
        ].includes(userId)
      ) {
        return res
          .status(404)
          .json({ message: "You are not authorized for this offer" });
      }
    }

    const transformedData = {
      _id: offer._id,
      title: offer.title,
      description: offer.description,
      price: offer.price,
      duration: offer.duration,
      status: offer.status,
      createdAt: offer.createdAt,

      sender: {
        _id: offer.senderId._id,
        fullName: offer.senderId.fullName,
        profilePictureUrl: offer.senderId.profilePictureUrl,
        title: offer.senderId.profile.professionalTitle,
        resumeUrl: offer.senderId.profile.resumeUrl,
        rating: offer.senderId.rating.isRated
          ? offer.senderId.rating.value
          : "not rated",
        yearsOfExperience: getTotalYearsWorkedWithMerging(
          offer.senderId.experiences || []
        ),
      },

      job: {
        _id: offer.jobId._id,
        title: offer.jobId.title,
        description: offer.jobId.description,
        job: offer.jobId.job,
        status: offer.jobId.status,
        location:
          offer.jobId.job == "freelance"
            ? "remote"
            : offer.jobId.simpleJobDetails?.locationCity +
              " " +
              offer.jobId.simpleJobDetails?.locationState,
        deadline: offer.jobId.deadline,
        experienceLevel:
          offer.jobId.job == "freelance"
            ? offer.jobId.freelanceJobDetails?.experienceLevel
            : offer.jobId.simpleJobDetails?.experienceLevel,
        applicantsCount: offer.jobId.applicants?.length || 0,
        budget: {
          type:
            offer.jobId.job == "simple"
              ? "fixed"
              : offer.jobId.freelanceJobDetails?.budget?.budgetType == "Fixed"
              ? "fixed"
              : "start" || "",
          price:
            offer.jobId.job == "freelance"
              ? offer.jobId.freelanceJobDetails?.budget?.price
              : null,
          min:
            offer.jobId.job == "simple"
              ? offer.jobId.simpleJobDetails?.minSalary
              : offer.jobId.freelanceJobDetails?.budget?.minimum || null,
          max:
            offer.jobId.job == "simple"
              ? offer.jobId.simpleJobDetails?.maxSalary
              : offer.jobId.freelanceJobDetails?.budget?.maximum || null,
        },
      },
    };

    // send email if updates are on
    if (offer.emailUpdates === true && offer.senderId.email) {
      const emailHtml = `
    <div style="font-family: Arial, sans-serif; padding: 10px;">
      <h2 style="color: #003366;">Offer Reviewed</h2>
      <p>Hello ${offer.senderId.fullName || "Freelancer"},</p>
      <p>Your offer titled <strong>"${
        offer.title
      }"</strong> has been reviewed by the employer.</p>
      <p>We will keep you updated on further actions.</p>
      <br/>
      <p>Regards,<br/>Freelancing Platform Team</p>
    </div>
  `;
      enqueueEmail(
        offer.senderId.email,
        "Your Offer Has Been Reviewed",
        emailHtml
      );
    }

    // mark as reviewd once receiver open it
    if (offer.status == "pending") {
      offer.status = "reviewed";
      transformedData.status = "reviewed";
      await offer.save();
    }

    return res.status(200).json({ offer: transformedData });
  } catch (err) {
    console.error("❌ Error retrieving offer for id " + offerId + ": ", err);
    return res.status(500).json({ message: "Error retrieving offer" });
  }
};

// const updateOfferSchema = z
//   .object({
//     proposedAmount: z.number().positive().optional(),
//     description: z.string().min(1).optional(),
//     milestones: z.array(milestoneSchema).optional(),
//   })
//   .strict(); // Prevent unexpected fields
// const editOffer = async (req, res) => {
//   const offerId = req.params.id;

//   // Validate ObjectId
//   if (!mongoose.Types.ObjectId.isValid(offerId)) {
//     return res.status(400).json({ message: "Invalid offer ID" });
//   }

//   // Parse and validate input
//   const updates = updateOfferSchema.parse(req.body);

//   // Find offer
//   const offer = await Offer.findOne({ _id: offerId });

//   if (!offer) {
//     return res.status(404).json({ message: "Offer not found" });
//   }

//   // Only allow update if offer is still pending
//   if (offer.status !== "pending") {
//     return res
//       .status(400)
//       .json({ message: "Only pending offers can be updated" });
//   }

//   // Ensure only the sender (freelancer) can edit
//   if (
//     !req.user?.role.includes("freelancer") ||
//     !offer.senderId.equals(req.user._id)
//   ) {
//     return res
//       .status(403)
//       .json({ message: "You are not authorized to update this offer" });
//   }

//   // Apply updates
//   if (updates.proposedAmount !== undefined)
//     offer.proposedAmount = updates.proposedAmount;
//   if (updates.description !== undefined)
//     offer.description = updates.description;
//   if (updates.milestones !== undefined) offer.milestones = updates.milestones;

//   await offer.save();

//   return res.status(200).json({
//     message: "Offer updated successfully",
//     offer,
//   });
// };

// const withdrawOffer = async (req, res) => {
//   const offerId = req.params.id;

//   // Validate offerId format
//   if (!mongoose.Types.ObjectId.isValid(offerId)) {
//     return res.status(400).json({ message: "Invalid offer ID" });
//   }

//   const offer = await Offer.findById(offerId);

//   if (!offer) {
//     return res.status(404).json({ message: "Offer not found" });
//   }

//   // Only allow the sender to withdraw
//   if (
//     !req.user?.role.includes("freelancer") ||
//     !offer.senderId.equals(req.user._id)
//   ) {
//     return res.status(403).json({
//       message: "You are not authorized to withdraw this offer",
//     });
//   }

//   if (offer.status === "withdrawn") {
//     return res.status(400).json({ message: "Offer already withdrawn" });
//   }

//   // Only pending offers can be withdrawn
//   if (offer.status !== "pending") {
//     return res
//       .status(400)
//       .json({ message: "Only pending offers can be withdrawn" });
//   }

//   // Update offer status
//   offer.status = "withdrawn";
//   await offer.save();

//   return res.status(200).json({
//     message: "Offer withdrawn successfully",
//     offer,
//   });
// };

// const rejectOffer = async (req, res) => {
//   const offerId = req.params.id;

//   // Validate offer ID format
//   if (!mongoose.Types.ObjectId.isValid(offerId)) {
//     return res.status(400).json({ message: "Invalid offer ID" });
//   }

//   const offer = await Offer.findById(offerId);

//   if (!offer) {
//     return res.status(404).json({ message: "Offer not found" });
//   }

//   // Only the receiver can reject the offer
//   if (!offer.receiverId.equals(req.user._id)) {
//     return res
//       .status(403)
//       .json({ message: "You are not authorized to reject this offer" });
//   }

//   if (offer.status === "rejected") {
//     return res.status(400).json({ message: "Offer already rejected" });
//   }

//   // Ensure offer is still pending
//   if (offer.status !== "pending") {
//     return res
//       .status(400)
//       .json({ message: "Only pending offers can be rejected" });
//   }

//   // Update status to 'rejected'
//   offer.status = "rejected";
//   await offer.save();

//   return res.status(200).json({
//     message: "Offer rejected successfully",
//     offer,
//   });
// };

// const getOfferById = async (req, res) => {
//   const offerId = req.params.id;

//   // Validate ObjectId
//   if (!mongoose.Types.ObjectId.isValid(offerId)) {
//     return res.status(400).json({ message: "Invalid offer ID" });
//   }

//   const offer = await Offer.findById(offerId)
//     .populate("senderId", "profile")
//     .populate("receiverId", "profile")
//     .populate("jobId", "title description price status");

//   // Optional access check (if you want only sender/receiver to view)
//   if (
//     (offer.senderId._id.equals(req.user?._id) &&
//       offer.receiverId._id.equals(req.user?._id)) ||
//     req.user?.role.includes("admin")
//   ) {
//     return res.status(200).json({ offer });
//   }
//   return res
//     .status(403)
//     .json({ message: "You are not authorized to view this offer" });
// };

// const ALLOWED_STATUSES = ["pending", "accepted", "rejected", "withdrawn"];
// const getAllOffers = async (req, res) => {
//   const { page = 1, limit = 10, senderId, receiverId, status } = req.query;
//   const filters = {};

//   // Validate and apply senderId filter
//   if (senderId) {
//     if (!mongoose.Types.ObjectId.isValid(senderId)) {
//       return res.status(400).json({ message: "Invalid senderId" });
//     }
//     filters.senderId = senderId;
//   }

//   // Validate and apply receiverId filter
//   if (receiverId) {
//     if (!mongoose.Types.ObjectId.isValid(receiverId)) {
//       return res.status(400).json({ message: "Invalid receiverId" });
//     }
//     filters.receiverId = receiverId;
//   }

//   // Validate and apply status filter
//   if (status) {
//     if (!ALLOWED_STATUSES.includes(status)) {
//       return res.status(400).json({ message: "Invalid offer status" });
//     }
//     filters.status = status;
//   }

//   const skip = (parseInt(page) - 1) * parseInt(limit);
//   const total = await Offer.countDocuments(filters);

//   const offers = await Offer.find(filters)
//     .sort({ createdAt: -1 })
//     .skip(skip)
//     .limit(parseInt(limit))
//     .select("-milestones");

//   if (!offers) {
//     return res.status(404).json({ message: "offers not found" });
//   }

//   return res.status(200).json({
//     total,
//     page: parseInt(page),
//     pages: Math.ceil(total / limit),
//     results: offers.length,
//     offers,
//   });
// };

// const acceptOffer = async (req, res) => {
//   const offerId = req.params.id;

//   // Validate offer ID format
//   if (!mongoose.Types.ObjectId.isValid(offerId)) {
//     return res.status(400).json({ message: "Invalid offer ID" });
//   }

//   const session = await mongoose.startSession();
//   try {
//     const offer = await Offer.findById(offerId).session(session);

//     if (!offer) {
//       return abortSessionWithMessage(res, session, "Offer not found!", 404);
//     }

//     // Only the receiver can reject the offer
//     if (!offer.receiverId.equals(req.user._id)) {
//       return abortSessionWithMessage(
//         res,
//         session,
//         "You are not authorized to reject this offer",
//         403
//       );
//     }

//     if (offer.status === "accepted") {
//       return abortSessionWithMessage(
//         res,
//         session,
//         "Offer already accepted",
//         400
//       );
//     }

//     // Ensure offer is still pending
//     if (offer.status !== "pending") {
//       return abortSessionWithMessage(
//         res,
//         session,
//         "Only pending offers can be accepted",
//         400
//       );
//     }

//     offer.status = "accepted";
//     await offer.save({ session });

//     const job = await Job.findByIdAndUpdate(offer.jobId).session(session);
//     if (!job) {
//       return abortSessionWithMessage(
//         res,
//         session,
//         "No matching Job found",
//         404
//       );
//     }

//     if (job.status === "filled") {
//       return abortSessionWithMessage(res, session, "Job already filled", 403);
//     }

//     if (job.status === "expired") {
//       return abortSessionWithMessage(res, session, "Job expired", 403);
//     }

//     job.status = "filled";
//     await job.save({ session });

//     // create order
//     const order = new Order({
//       offerId: offer._id,
//       jobId: offer.jobId,
//       employerId: offer.receiverId,
//       freelancerId: offer.senderId,
//       title: job.title,
//       description: job.description,
//       totalAmount: offer.proposedAmount,
//     });

//     await order.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     return res.status(200).json({
//       message: "Offer accepted successfully",
//       order_id: order._id,
//     });
//   } catch (err) {
//     console.error("❌ Failed to Accept offer:", err);
//     return abortSessionWithMessage(res, session, "Server error", 500);
//   }
// };

export {
  createOffer,
  getUserOffers,
  getReceivedOffers,
  getOfferById,
  // editOffer,
  // withdrawOffer,
  // rejectOffer,
  // getOfferById,
  // getAllOffers,
  // acceptOffer,
};
