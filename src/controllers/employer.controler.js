import mongoose from "mongoose";
import dotenv from "dotenv";
import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import Offer from "../database/models/offers.model.js";
import Application from "../database/models/applications.model.js";
import { getMemorySubscriptionns } from "./subscriptions.controller.js";

dotenv.config();

// Edit employer
const editEmployerProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters long"),

  about: z
    .string()
    .trim()
    .max(1000, "About section can be up to 1000 characters")
    .optional()
    .or(z.literal("")),

  location: z
    .string()
    .trim()
    .max(255, "Location is too long")
    .optional()
    .or(z.literal("")),

  website: z.string().trim().optional().or(z.literal("")),

  phoneNumber: z
    .string()
    .trim()
    .min(5, "Phone number is too short")
    .max(20, "Phone number is too long")
    .optional()
    .or(z.literal("")),

  profilePictureUrl: z
    .string()
    .trim()
    .url("Invalid logo URL")
    .optional()
    .or(z.literal("")),

  bannerUrl: z
    .string()
    .trim()
    .url("Invalid banner URL")
    .optional()
    .or(z.literal("")),
});
const editEmployerProfile = async (req, res) => {
  const updates = editEmployerProfileSchema.parse(req.body);
  try {
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid User Id" });
    }

    const user = await EMPLOYER.findOne({
      _id: userId,
      status: { $nin: ["suspended", "deleted"] },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.fullName = updates.fullName;
    user.profilePictureUrl = updates.profilePictureUrl;
    user.bannerUrl = updates.bannerUrl;
    user.location = updates.location;
    user.website = updates.website;
    user.about = updates.about;
    user.phoneNumber = updates.phoneNumber;

    await user.save();

    return res
      .status(200)
      .json({ message: "Employer profile updated successfully" });
  } catch (err) {
    console.log("Error upding employer profile: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getEmployerProfile = async (req, res) => {
  const userId = req.user?._id;
  const user = await EMPLOYER.findOne(
    { _id: userId, status: { $nin: ["deleted"] } },
    {
      email: 1,
      fullName: 1,
      profilePictureUrl: 1,
      status: 1,
      about: 1,
      location: 1,
      website: 1,
      phoneNumber: 1,
      bannerUrl: 1,
      jobsCreated: 1,
      ordersCompleted: 1,
      createdAt: 1,
      currentSubscription: 1,
      susbscriptionRenew: 1,
    }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  let currentSusbscription;
  if (user.currentSubscription) {
    if (new Date(user.currentSubscription.end) > new Date()) {
      const memorySusbcriptions = await getMemorySubscriptionns();
      const sub = memorySusbcriptions.find(
        (e) => e._id == user.currentSubscription.subId
      );

      if (sub) {
        currentSusbscription = {
          autoRenew: user.susbscriptionRenew,
          title: sub.name,
          description: sub.description,
          start: user.currentSubscription.start,
          end: user.currentSubscription.end,
        };
      }
    } else {
      user.currentSubscription = null;
      await user.save();
    }
  }

  const tempUser = {
    _id: user._id,
    fullName: user.fullName,
    email: user.email,
    profilePictureUrl: user.profilePictureUrl,
    status: user.status,
    bannerUrl: user.bannerUrl,
    about: user.about,
    location: user.location,
    website: user.website,
    phoneNumber: user.phoneNumber,
    jobsCreated: user.jobsCreated,
    ordersCompleted: user.ordersCompleted,
    createdAt: user.createdAt,
    currentSusbscription,
  };

  return res.status(200).json({
    user: tempUser,
  });
};

const getEmployerProfileById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ message: "No ID" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const user = await EMPLOYER.findOne(
      { _id: id, status: { $nin: ["deleted"] } },
      {
        email: 1,
        fullName: 1,
        profilePictureUrl: 1,
        status: 1,
        about: 1,
        location: 1,
        website: 1,
        phoneNumber: 1,
        bannerUrl: 1,
        jobsCreated: 1,
        ordersCompleted: 1,
        createdAt: 1,
      }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const tempUser = {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePictureUrl: user.profilePictureUrl,
      status: user.status,
      bannerUrl: user.bannerUrl,
      about: user.about,
      location: user.location,
      website: user.website,
      phoneNumber: user.phoneNumber,
      jobsCreated: user.jobsCreated,
      ordersCompleted: user.ordersCompleted,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      user: tempUser,
    });
  } catch (err) {
    console.log("❌ Error getting employer profile by id: ", err);
    return res.status(500).json("Error getting employer profile", err);
  }
};

// const getAllEmployers = async (req, res) => {
//   // Parse query parameters
//   const page = parseInt(req.query.page) || 1;
//   const limit = parseInt(req.query.limit) || 10;
//   const skip = (page - 1) * limit;

//   const [total, employers] = await Promise.all([
//     User.countDocuments({
//       role: { $in: ["employer"] },
//       status: { $nin: ["deleted"] },
//     }),
//     User.find({
//       role: { $in: ["employer"] },
//       status: { $nin: ["deleted"] },
//     })
//       .select({
//         email: 1,
//         status: 1,
//         profile: 1,
//         employerDetails: 1,
//       })
//       .skip(skip)
//       .limit(limit),
//   ]);

//   return res.status(200).json({
//     page,
//     limit,
//     totalPages: Math.ceil(total / limit),
//     totalEmployers: total,
//     employers,
//   });
// };

const getEmployerDashboardData = async (req, res) => {
  try {
    const userId = await req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid User" });
    }

    const user = await EMPLOYER.findById(userId);
    if (!user || user.status == "deleted") {
      return res.status(401).json({ message: "User not found!" });
    }

    if (user.currentSubscription) {
      if (new Date(user.currentSubscription.end) < new Date()) {
        user.currentSubscription = null;
        await user.save();
      }
    }

    const offers = await Offer.find({ receiverId: userId }).populate(
      "senderId",
      "fullName profilePictureUrl profile.professionalTitle profile.resumeUrl"
    );

    const jobs = await Job.find({ employerId: userId });

    const applications = await Application.countDocuments({
      employerId: userId,
      status: "pending",
    });

    const newApplications =
      offers.filter((e) => e.status === "pending").length + applications;

    const activeJobs = jobs.filter(
      (e) => e.status === "filled" || e.status == "empty"
    ).length;
    // const completedJobs = jobs.filter((e) => e.status === "completed").length;
    const totalHires = jobs.filter(
      (e) => e.status === "filled" || e.status == "completed"
    ).length;

    const latestApplicantsOffers = offers
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
      .slice(0, 3);

    const transformOffers = latestApplicantsOffers.map((e) => ({
      _id: e._id,
      senderId: e.senderId._id,
      fullName: e.senderId.fullName,
      profilePictureUrl: e.senderId.profilePictureUrl || "",
      professionalTitle: e.senderId.profile.professionalTitle || "",
      resumeLink: e.senderId.profile.resumeUrl || "",
      appliedAt: e.createdAt,
      status: e.status,
    }));

    const transformedData = {
      fullName: user.fullName,
      newApplicantsCount: newApplications,
      activeJobs: activeJobs,
      totalApplications: offers.length,
      totalHires: totalHires,
      applications: transformOffers,
    };

    return res.status(200).json({ data: transformedData });
  } catch (err) {
    console.error("❌ Error getting  info:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export { getEmployerDashboardData, editEmployerProfile, getEmployerProfile, getEmployerProfileById };
