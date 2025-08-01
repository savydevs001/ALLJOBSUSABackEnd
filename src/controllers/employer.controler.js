import User from "../database/models/users.model.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { z } from "zod";
import { jwtToken } from "../utils/jwt.js";
import Job from "../database/models/jobs.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import Offer from "../database/models/offers.model.js";
import Application from "../database/models/applications.model.js";

dotenv.config();

// ZOD Schemas
// const subscriptionZodSchema = z.object({
//   planId: z
//     .string()
//     .regex(/^[a-f\d]{24}$/i, "Invalid ObjectId")
//     .optional(),
//   status: z.enum(["active", "inactive"]).optional(),
//   startDate: z.string().datetime().optional(),
//   endDate: z.string().datetime().optional(),
//   autoRenew: z.boolean().optional(),
// });

// Controllers
// const enableEmployerProfile = async (req, res) => {
//   const userId = req.user?._id;
//   const user = await User.findById(userId);
//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }
//   if (user.role.includes("employer")) {
//     return res
//       .status(400)
//       .json({ message: "Employer profile already enabled" });
//   }
//   user.role.push("employer");
//   await user.save();

//   const token = jwtToken(user);
//   if (!token) {
//     return res.status(500).json({ message: "Server Error" });
//   }

//   res.cookie(process.env.JWT_COOKIE_NAME, token, {
//     httpOnly: true,
//     secure: process.env.NODE_ENV === "production",
//     maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
//   });

//   return res
//     .status(200)
//     .json({ message: "Employer profile enabled successfully", token });
// };

// const addEmployerProfile = async (req, res) => {
//   const data = employerDetailsZodSchema.parse(req.body);

//   const userId = req.user?._id;
//   const user = await User.findOne({
//     _id: userId,
//     status: { $nin: ["suspended", "deleted"] },
//   });

//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   if (user.role.includes("employer")) {
//     // Check if employer details already exist
//     if (user.employerDetails) {
//       return res
//         .status(400)
//         .json({ message: "Employer profile already exists" });
//     }

//     // Add Employer details to user
//     user.employerDetails = data;
//     await user.save();
//     return res.status(201).json({
//       message: "Employer profile created successfully",
//       employerDetails: user.employerDetails,
//     });
//   }
//   return res
//     .status(403)
//     .json({ message: "Only Employer can add Employer details" });
// };

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
    }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json({
    user: user,
  });
};

// const getEmployerProfileById = async (req, res) => {
//   const { id } = req.params;
//   if (!id) {
//     return res.status(400).json({ message: "No ID" });
//   }

//   if (!mongoose.Types.ObjectId.isValid(id)) {
//     return res.status(400).json({ message: "Invalid ID" });
//   }

//   const user = await User.findOne(
//     { _id: id, status: { $nin: ["deleted"] } },
//     {
//       email: 1,
//       status: 1,
//       profile: 1,
//       employerDetails: 1,
//     }
//   );

//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   if (!user.employerDetails) {
//     return res.status(404).json({ message: "Employer profile not set" });
//   }

//   return res.status(200).json({
//     user: user,
//   });
// };

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

    const offers = await Offer.find({ receiverId: userId }).populate(
      "senderId",
      "fullName profilePictureUrl profile.professionalTitle profile.resumeUrl"
    );

    const jobs = await Job.find({ employerId: userId });

    const applications = await Application.countDocuments({employerId: userId, status: "pending"})

    const newApplications = offers.filter((e) => e.status === "pending").length + applications;

    const activeJobs = jobs.filter((e) => e.status === "filled").length;
    const completedJobs = jobs.filter((e) => e.status === "completed").length;
    const totalHires = activeJobs + completedJobs;

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

export {
  getEmployerDashboardData,
  // enableEmployerProfile,
  // addEmployerProfile,
  editEmployerProfile,
  getEmployerProfile,
  // getEmployerProfileById,
  // getAllEmployers,
};
