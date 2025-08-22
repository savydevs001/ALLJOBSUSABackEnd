import Offer from "../database/models/offers.model.js";
import mongoose from "mongoose";
import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import enqueueEmail from "../services/emailSender.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import { notifyUser } from "./notification.controller.js";
import { sendOfferCreationMessage } from "../socket/init-socket.js";

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
    const jobId = req.params.jobid || "";
    const employerId = req.query.employerId || "";
    const sendMessage = req.query.sendMessage || false;

    if (jobId && jobId !== "" && !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid Job id" });
    }

    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User id" });
    }

    const user = await FREELANCER.findById(userId);
    if (!user || user.status === "deleted") {
      return res.status(400).json({ message: "User not found!" });
    }
    if (user.status === "suspended") {
      return res
        .status(400)
        .json({ message: "Suspended users cannot create offers" });
    }
    if (user.onboarded !== true) {
      return res.status(400).json({
        onBoardRequired: true,
        message: "Please complete your onboarding process in Earnings section",
      });
    }

    let job = null;
    if (jobId) {
      job = await Job.findById(jobId).populate("employerId", "fullName");
      if (!job) return res.status(404).json({ message: "Job not found!" });
      if (job.status === "expired" || job.deadline < new Date()) {
        return res.status(400).json({ message: "Job Expired" });
      }

      const existingOffer = await Offer.findOne({
        senderId: userId,
        jobId: job._id,
      });
      if (existingOffer) {
        return res.status(400).json({
          message: "You have already made an offer to this job",
          offer_id: existingOffer._id,
        });
      }
    }

    if (!job && (!employerId || !mongoose.Types.ObjectId.isValid(employerId))) {
      return res.status(400).json({ message: "Invalid Employer ID" });
    }

    let employer = await EMPLOYER.findById(job ? job.employerId : employerId);
    let receiverModel = "employer";

    if (!employer) {
      employer = await JOBSEEKER.findById(employerId);
      if (!employer) {
        return res.status(404).json({ message: "Invalid Employer" });
      }
      receiverModel = "jobSeeker";
    }

    if (employer.status !== "active") {
      return res
        .status(400)
        .json({ message: "Employer account suspended or deleted" });
    }

    if (employer.email === user.email) {
      return res
        .status(400)
        .json({ message: "Sender and receiver cannot be the same person" });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const offer = new Offer({
        senderId: userId,
        receiverId: job ? job.employerId : employer._id,
        receiverModel: job ? "employer" : receiverModel,
        jobId: job ? job._id : null,
        duration: data.duration,
        price: data.price,
        title: data.title,
        description: data.description,
        milestones: data.milestones || [],
      });

      // Update job applicants
      if (job) {
        const alreadyApplied = job.applicants.some(
          (app) =>
            app.userId?.toString() === user._id.toString() &&
            app.role === "freelancer"
        );

        if (!alreadyApplied) {
          job.applicants.push({
            userId: user._id,
            role: "freelancer",
          });
        }
      }

      // Add to recent activity
      user.activity.unshift({
        title: `Create Offer ${offer.title}`,
        subTitle: employer.fullName,
        at: new Date(),
      });
      if (user.activity.length > 3) {
        user.activity.splice(3);
      }

      user.profile.jobActivity.applicationsSent =
        (user.profile?.jobActivity?.applicationsSent || 0) + 1;

      await offer.save({ session });
      if (job) await job.save({ session });
      await user.save({ session });

      await session.commitTransaction();
      session.endSession();

      if (sendMessage) {
        sendOfferCreationMessage({
          from: userId.toString(),
          message: `New Offer: ${offer.title} at ${new Date()
            .toISOString()
            .slice(0, 10)}`,
          to: employer._id.toString(),
          offerId: offer._id.toString(),
        });
      }

      await notifyUser({
        userId: employerId.toString(),
        userMail: employer.email,
        ctaUrl: `offers/${offer._id.toString()}`,
        title: "New Offer received",
        message: offer.title,
        from: user.fullName,
      });

      return res.status(200).json({
        message: "Offer created successfully",
        offer_id: offer._id,
      });
    } catch (err) {
      console.error("❌ Error creating Offer:", err);
      await session.abortTransaction();
      session.endSession();
      return res.status(500).json({ message: "Server Error" });
    }
  } catch (err) {
    console.error("❌ Error creating Offer:", err);
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
      .lean();

    // Manually populate receiverId based on receiverModel
    const populatedOffers = await Promise.all(
      offers.map(async (offer) => {
        if (offer.receiverId) {
          const Model = mongoose.model(offer.receiverModel);
          const receiver = await Model.findById(offer.receiverId)
            .select("fullName")
            .lean();
          return {
            ...offer,
            receiverId: receiver, // This replaces the ObjectId with the full document
          };
        }
        return offer;
      })
    );

    return res.status(200).json({
      offers: populatedOffers,
    });
  } catch (err) {
    console.log("❌ Error fetching Offers: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Received Offers
// const getReceivedOffers = async (req, res) => {
//   try {
//     const skip = parseInt(req.query.skip) || 0;
//     const limit = parseInt(req.query.limit) || 10;
//     const text = req.query.text?.trim();
//     const status = req.query.status?.trim();
//     const userId = req.user?._id;

//     if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(401).json({ message: "Invalid user" });
//     }

//     const textTerms = text
//       ? text
//           .split(" ")
//           .map((t) => t.trim())
//           .filter(Boolean)
//       : [];

//     const initialFilter = {
//       receiverId: new mongoose.Types.ObjectId(userId),
//     };

//     if (status) {
//       initialFilter.status = status;
//     }

//     const matchStages = [{ ...initialFilter }];

//     if (textTerms.length > 0) {
//       const orConditions = textTerms.map((term) => {
//         const regex = new RegExp(term, "i");
//         return {
//           $or: [
//             { title: { $regex: regex } },
//             { description: { $regex: regex } },
//             { "sender.fullName": { $regex: regex } },
//             { "job.title": { $regex: regex } }, // added job title filtering
//           ],
//         };
//       });
//       matchStages.push(...orConditions);
//     }

//     const offers = await Offer.aggregate([
//       { $match: initialFilter },
//       {
//         $lookup: {
//           from: "freelancers",
//           localField: "senderId",
//           foreignField: "_id",
//           as: "sender",
//         },
//       },
//       { $unwind: "$sender" },
//       {
//         $lookup: {
//           from: "jobs",
//           localField: "jobId",
//           foreignField: "_id",
//           as: "job",
//         },
//       },
//       { $unwind: "$job" },
//       ...(textTerms.length > 0 ? [{ $match: { $and: matchStages } }] : []),
//       { $sort: { createdAt: -1 } },
//       { $skip: skip },
//       { $limit: limit },
//       {
//         $project: {
//           _id: 1,
//           jobId: 1,
//           status: 1,
//           createdAt: 1,
//           jobTitle: "$job.title",
//           sender: {
//             _id: "$sender._id",
//             fullName: "$sender.fullName",
//             profilePictureUrl: {
//               $ifNull: ["$sender.profilePictureUrl", ""],
//             },
//             title: "$sender.profile.professionalTitle",
//             resumeUrl: {
//               $ifNull: ["$sender.profile.resumeUrl", ""],
//             },
//             rating: {
//               $cond: [
//                 "$sender.rating.isRated",
//                 "$sender.rating.value",
//                 "not rated",
//               ],
//             },
//             experiences: "$sender.profile.experiences",
//           },
//         },
//       },
//     ]);

//     console.log("ok: ", offers);

//     const transformedOffers = offers.map((e) => {
//       const yearsOfExperience = getTotalYearsWorkedWithMerging(
//         e.sender.experiences || []
//       );

//       return {
//         _id: e._id,
//         jobId: e.jobId,
//         appliedTo: e.jobTitle, // ✅ now using actual job title
//         status: e.status,
//         createdAt: e.createdAt,
//         sender: {
//           _id: e.sender._id,
//           fullName: e.sender.fullName,
//           profilePictureUrl: e.sender.profilePictureUrl || "",
//           title: e.sender.title || "",
//           resumeUrl: e.sender.resumeUrl || "",
//           rating: e.sender.rating,
//           yearsOfExperience,
//         },
//       };
//     });

//     return res.status(200).json({ offers: transformedOffers });
//   } catch (err) {
//     console.error("❌ Error retrieving received offers:", err);
//     return res
//       .status(500)
//       .json({ message: "Error retrieving received offers" });
//   }
// };
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

    const initialFilter = {
      receiverId: new mongoose.Types.ObjectId(userId),
    };

    if (status) {
      initialFilter.status = status;
    }

    const matchStages = [{ ...initialFilter }];

    if (textTerms.length > 0) {
      const orConditions = textTerms.map((term) => {
        const regex = new RegExp(term, "i");
        return {
          $or: [
            { title: { $regex: regex } },
            { description: { $regex: regex } },
            { "sender.fullName": { $regex: regex } },
            { "job.title": { $regex: regex } },
          ],
        };
      });
      matchStages.push(...orConditions);
    }

    const offers = await Offer.aggregate([
      { $match: initialFilter },
      {
        $lookup: {
          from: "freelancers",
          localField: "senderId",
          foreignField: "_id",
          as: "sender",
        },
      },
      { $unwind: { path: "$sender", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "jobs",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: { path: "$job", preserveNullAndEmptyArrays: true } },
      ...(textTerms.length > 0 ? [{ $match: { $and: matchStages } }] : []),
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $project: {
          _id: 1,
          jobId: 1,
          status: 1,
          createdAt: 1,
          jobTitle: "$job.title",
          sender: {
            _id: "$sender._id",
            fullName: "$sender.fullName",
            profilePictureUrl: { $ifNull: ["$sender.profilePictureUrl", ""] },
            title: "$sender.profile.professionalTitle",
            resumeUrl: { $ifNull: ["$sender.profile.resumeUrl", ""] },
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
        e.sender?.experiences || []
      );

      return {
        _id: e._id,
        jobId: e.jobId,
        appliedTo: e.jobTitle || "",
        status: e.status,
        createdAt: e.createdAt,
        sender: {
          _id: e.sender?._id || null,
          fullName: e.sender?.fullName || "",
          profilePictureUrl: e.sender?.profilePictureUrl || "",
          title: e.sender?.title || "",
          resumeUrl: e.sender?.resumeUrl || "",
          rating: e.sender?.rating ?? "not rated",
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
        "_id fullName email profilePictureUrl profile.bio profile.skills profile.resumeUrl profile.professionalTitle profile.experiences rating"
      )
      .populate(
        "receiverId",
        "_id fullName profilePictureUrl about jobsCreated"
      )
      .populate(
        "jobId",
        "_id title description job status simpleJobDetails.locationState simpleJobDetails.locationCity deadline simpleJobDetails.experienceLevel freelanceJobDetails.experienceLevel applicants simpleJobDetails.minSalary simpleJobDetails.maxSalary freelanceJobDetails.budget"
      );

    if (!offer) {
      return res.status(404).json({ message: "No Offer found" });
    }

    if (!req.user || !["admin", "manager"].includes(req.user?.role)) {
      if (
        ![
          offer.senderId._id.toString(),
          offer.receiverId._id.toString(), // since not populated
        ].includes(userId)
      ) {
        return res
          .status(403)
          .json({ message: "You are not authorized for this offer" });
      }
    }

    const transformedData = {
      _id: offer._id,
      title: offer.title,
      description: offer.description,
      orderId: offer.orderId,
      price: offer.price,
      duration: offer.duration,
      status: offer.status,
      createdAt: offer.createdAt,
      receiver: {
        _id: offer.receiverId._id,
        about: offer.receiverId.about,
        fullName: offer.receiverId.fullName,
        profilePictureUrl: offer.receiverId.profilePictureUrl || "",
        jobsCreated: offer.receiverId.jobsCreated || 0,
        role: offer.receiverModel == "jobSeeker" ? "job-seeker" : "employer",
      },

      sender: {
        _id: offer.senderId._id,
        fullName: offer.senderId.fullName,
        profilePictureUrl: offer.senderId.profilePictureUrl || "",
        title: offer.senderId.profile?.professionalTitle || "",
        resumeUrl: offer.senderId.profile?.resumeUrl || "",
        rating: offer.senderId.rating?.isRated
          ? offer.senderId.rating.value
          : "not rated",
        yearsOfExperience: getTotalYearsWorkedWithMerging(
          offer.senderId.profile?.experiences || []
        ),
        bio: offer.senderId.profile?.bio || "",
        skills: offer.senderId.profile?.skills || [],
      },
    };

    if (offer.jobId) {
      const jobType = offer.jobId.job;
      transformedData.job = {
        _id: offer.jobId._id,
        title: offer.jobId.title,
        description: offer.jobId.description,
        job: jobType,
        status: offer.jobId.status,
        location:
          jobType === "freelance"
            ? "remote"
            : `${offer.jobId.simpleJobDetails?.locationCity || ""}, ${
                offer.jobId.simpleJobDetails?.locationState || ""
              }`,
        deadline: offer.jobId.deadline,
        experienceLevel:
          jobType === "freelance"
            ? offer.jobId.freelanceJobDetails?.experienceLevel
            : offer.jobId.simpleJobDetails?.experienceLevel,
        applicantsCount: offer.jobId.applicants?.length || 0,
        budget: {
          type:
            jobType === "simple"
              ? "fixed"
              : offer.jobId.freelanceJobDetails?.budget?.budgetType === "Fixed"
              ? "fixed"
              : "start",
          price:
            jobType === "freelance"
              ? offer.jobId.freelanceJobDetails?.budget?.price
              : null,
          min:
            jobType === "simple"
              ? offer.jobId.simpleJobDetails?.minSalary
              : offer.jobId.freelanceJobDetails?.budget?.minimum || null,
          max:
            jobType === "simple"
              ? offer.jobId.simpleJobDetails?.maxSalary
              : offer.jobId.freelanceJobDetails?.budget?.maximum || null,
        },
      };
    }

    // Send email if updates enabled
    if (offer.emailUpdates && offer.senderId.email) {
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

    // Mark as reviewed if currently pending
    if (
      offer.status === "pending" &&
      req.user?._id.toString() == offer.receiverId.toString()
    ) {
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

const rejectOffer = async (req, res) => {
  const offerId = req.params.id;

  // Validate offer ID format
  if (!mongoose.Types.ObjectId.isValid(offerId)) {
    return res.status(400).json({ message: "Invalid offer ID" });
  }

  const offer = await Offer.findById(offerId)
    .populate("receiverId", "fullName")
    .populate("senderId", "email");

  if (!offer) {
    return res.status(404).json({ message: "Offer not found" });
  }

  // Only the receiver can reject the offer
  if (!offer.receiverId.equals(req.user?._id)) {
    return res
      .status(403)
      .json({ message: "You are not authorized to reject this offer" });
  }

  if (offer.status === "rejected") {
    return res.status(400).json({ message: "Offer already rejected" });
  }

  // Ensure offer is still pending
  if (!["pending", "reviewed", "interviewing"].includes(offer.status)) {
    return res
      .status(400)
      .json({ message: "Only pending offers can be rejected" });
  }

  // Update status to 'rejected'
  offer.status = "rejected";
  await offer.save();

  await notifyUser({
    userId: offer.senderId.toString(),
    userMail: offer.senderId.email,
    ctaUrl: `offers/${offer._id.toString()}`,
    title: `Offer ${offer._id.toString()} Rejected`,
    message: offer.title,
    from: offer.receiverId.fullName || "Employer",
  });

  return res.status(200).json({
    message: "Offer rejected successfully",
  });
};

// withdraw offer
const withdrawOffer = async (req, res) => {
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
  if (!offer.senderId.equals(req.user?._id)) {
    return res
      .status(403)
      .json({ message: "You are not authorized to withdraw this offer" });
  }

  if (offer.status === "withdrawn") {
    return res.status(400).json({ message: "Offer already withdrawn" });
  }

  // Ensure offer is still pending
  if (!["pending", "reviewed", "interviewing"].includes(offer.status)) {
    return res
      .status(400)
      .json({ message: "Only pending offers can be withdrawn" });
  }

  // Update status to 'rejected'
  offer.status = "withdrawn";
  await offer.save();

  return res.status(200).json({
    message: "Offer withdrawn successfully",
  });
};

// get offer for message box
const getOfferByIdForMessage = async (req, res) => {
  const offerId = req.params?.id;

  try {
    if (!offerId || !mongoose.Types.ObjectId.isValid(offerId)) {
      return res.status(404).json({ message: "Offer not found" });
    }

    const offer = await Offer.findById(offerId).populate(
      "senderId",
      "_id fullName profilePictureUrl rating"
    );

    if (!offer) {
      return res.status(404).json({ message: "No Offer found" });
    }

    const transformedData = {
      _id: offer._id,
      title: offer.title,
      description: offer.description,
      price: offer.price,
      duration: offer.duration,
      status: offer.status,
      createdAt: offer.createdAt,
      orderId: offer.orderId,
      receiverId: offer.receiverId?.toString(),
      freelancer: {
        _id: offer.senderId._id?.toString(),
        fullName: offer.senderId.fullName,
        profilePictureUrl: offer.senderId.profilePictureUrl,
        isRated: offer.senderId.rating.isRated || false,
        value: offer.senderId.rating.value || 0,
      },
    };

    return res.status(200).json({ offer: transformedData });
  } catch (err) {
    console.error("❌ Error retrieving offer for id " + offerId + ": ", err);
    return res.status(500).json({ message: "Error retrieving offer" });
  }
};

export {
  createOffer,
  getUserOffers,
  getReceivedOffers,
  getOfferById,
  rejectOffer,
  getOfferByIdForMessage,
  withdrawOffer,
};
