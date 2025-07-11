import mongoose from "mongoose";
import User from "../database/models/users.model.js";
import dotenv from "dotenv";
import { z } from "zod";
import { jwtToken } from "../utils/jwt.js";
import FREELANCER from "../database/models/freelancer.model.js";
import uploadProfile from "../utils/files/uploadProfile.js";

dotenv.config();

// ZOD Schemas
const createProfileZODSchema = z.object({
  professionalTitle: z
    .string()
    .min(5, "Min 5 chracter required")
    .max(200, "Max 200 chracters allowed"),
  hourlyRate: z.string().min(1, "Hourly rate required"),
  skills: z.array(z.string()).min(1, "At lease 1 skill required"),
  bio: z
    .string()
    .min(10, "At least 10 chracters required")
    .max(2000, "Max 2000 chracters allowed"),
  freelancerWork: z.enum(["true", "false"]).default("false"),
  projects: z.array(z.string()).default([]),
  samples: z.array(z.string()).default([]),
  badge: z
    .array(z.enum(["Top-rated", "New-talent", "Fast-response"]))
    .default(["New-talent"]),
});

// Controllers
const creatFreelancerProfile = async (req, res) => {
  const data = createProfileZODSchema.parse(req.body);
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(403).json({ message: "Invalid User" });
    }

    const freelancer = await FREELANCER.findById(userId);
    if (!freelancer) {
      return res.status(403).json({ message: "No User found!" });
    }

    if (freelancer.profile) {
      return res.status(403).json({ message: "Profile already set" });
    }

    freelancer.profile = data;
    freelancer.profile.freelancerWork = data.freelancerWork === "true";
    if (req.file && req.newName) {
      freelancer.profilePictureUrl = `${req.newName.replace(/\\/g, "/")}`;
    }

    await freelancer.save();

    return res.status(201).json({ message: "Profile created successfully" });
  } catch (err) {
    console.log("❌ Error creating freelance profile: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Get Profile
const getFreelancerProfile = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(403).json({ message: "Invalid User" });
    }

    const user = await FREELANCER.findOne(
      { _id: userId, status: { $nin: ["deleted"] } },
      {
        fullName: 1,
        email: 1,
        profilePictureUrl: 1,
        profile: 1,
      }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.profile) {
      return res.status(404).json({ message: "Freelancer profile not set" });
    }

    const data = {
      fullName: user.fullName,
      email: user.email,
      ...user.profile,
      profilePictureUrl: user.profilePictureUrl,
    };

    return res.status(200).json({
      user: data,
    });
  } catch (err) {
    console.log("❌ Error getting freelance profile: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Edit Profile
// const editFreelanceProfile = async (req, res, next) => {
//   const updates = updateFreelancerDetailsZodSchema.parse(req.body);

//   const userId = req.user?._id;

//   if (!userId) {
//     return res.status(404).json({ message: "User invalid" });
//   }
//   const user = await User.findOne({
//     _id: userId,
//     status: { $nin: ["suspended", "deleted"] },
//   });

//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   if (!user.role.includes("freelancer")) {
//     return res.status(403).json({
//       message: "Only freelancers can update freelancer details",
//     });
//   }

//   const existingDetails = user.freelancerDetails?.toObject() || {};
//   user.freelancerDetails = {
//     ...existingDetails,
//     ...updates,
//   };

//   await user.save();

//   return res.status(200).json({
//     message: "Freelancer profile updated successfully",
//     freelancerDetails: user.freelancerDetails,
//   });
// };

// const featureEnum = z.enum(["pro", "top_rated", "new_talent", "rising star"]);
// const freelancerDetailsZodSchema = z.object({
//   jobTitle: z.string().min(2, "Job title is required"),
//   jobTags: z.array(z.string().min(1)).min(1, "At least one tag is required"),
//   yearsOfExperience: z
//     .number()
//     .int()
//     .nonnegative("Years of experience must be 0 or more"),

//   hourlyRate: z
//     .number()
//     .positive("Hourly rate must be greater than 0")
//     .max(10000),

//   location: z.string().min(3, "Location is required"),

//   description: z
//     .string()
//     .min(10, "Description must be at least 10 characters long")
//     .max(1000),
// });

// export const updateFreelancerDetailsZodSchema = z
//   .object({
//     jobTitle: z
//       .string()
//       .min(2, "Job title must be at least 2 characters")
//       .optional(),

//     jobTags: z.array(z.string().min(1, "Tags cannot be empty")).optional(),

//     yearsOfExperience: z
//       .number()
//       .min(0, "Years of experience cannot be negative")
//       .max(100, "Years of experience seems too high")
//       .optional(),

//     hourlyRate: z.number().min(0, "Hourly rate must be positive").optional(),

//     location: z.string().min(2, "Location is too short").optional(),
//     description: z.string().max(1000).optional(),
//   })
//   .partial(); // allows any subset of the above fields

// const enableFreelancerProfile = async (req, res) => {
//   const userId = req.user?._id;
//   const user = await User.findById(userId);
//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }
//   if (user.role.includes("freelancer")) {
//     return res
//       .status(400)
//       .json({ message: "Freelancer profile already enabled" });
//   }
//   user.role.push("freelancer");
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
//     .json({ message: "Freelancer profile enabled successfully", token });
// };

// const addFreelanceProfile = async (req, res, next) => {
//   const data = freelancerDetailsZodSchema.parse(req.body);

//   const userId = req.user?._id;

//   const user = await User.findOne({
//     _id: userId,
//     status: { $nin: ["suspended", "deleted"] },
//   });

//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   if (!user.role.includes("freelancer")) {
//     return res.status(403).json({
//       message: "Only freelancers can add freelancer details",
//     });
//   }

//   if (user.freelancerDetails) {
//     return res.status(400).json({
//       message: "Freelancer profile already exists",
//     });
//   }
//   user.freelancerDetails = data;
//   await user.save();

//   return res.status(201).json({
//     message: "Freelancer profile created successfully",
//     freelancerDetails: user.freelancerDetails,
//   });
// };

// const getFreelancerProfile = async (req, res) => {
//   const userId = req.user?._id;
//   const user = await User.findOne(
//     { _id: userId, status: { $nin: ["deleted"] } },
//     {
//       email: 1,
//       status: 1,
//       profile: 1,
//       freelancerDetails: 1,
//     }
//   );

//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   if (!user.freelancerDetails) {
//     return res.status(404).json({ message: "Freelancer profile not set" });
//   }

//   return res.status(200).json({
//     user: user,
//   });
// };

// const getFreelancerProfileById = async (req, res) => {
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
//       freelancerDetails: 1,
//     }
//   );

//   if (!user) {
//     return res.status(404).json({ message: "User not found" });
//   }

//   if (!user.freelancerDetails) {
//     return res.status(404).json({ message: "Freelancer profile not set" });
//   }

//   return res.status(200).json({
//     user: user,
//   });
// };

// const getAllFreelancers = async (req, res) => {
//   try {
//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;

//     const {
//       skills, // Comma-separated skills
//       minExperience,
//       maxExperience,
//       minRate,
//       maxRate,
//       search,
//     } = req.query;

//     const filters = {
//       role: { $in: ["freelancer"] },
//       status: { $nin: ["deleted"] },
//     };

//     // Skill filtering based on jobTags
//     if (skills) {
//       const skillArray = skills.split(",").map((s) => s.trim());
//       filters["freelancerDetails.jobTags"] = { $in: skillArray };
//     }

//     // 🔍 Full-text search on skills or fullName
//     if (search && search.trim() !== "") {
//       const searchRegex = new RegExp(search.trim(), "i");
//       filters.$or = [
//         { "freelancerDetails.jobTags": { $regex: searchRegex } },
//         { "profile.fullName": { $regex: searchRegex } },
//       ];
//     }

//     // Years of experience filter
//     if (minExperience || maxExperience) {
//       filters["freelancerDetails.yearsOfExperience"] = {};
//       if (minExperience)
//         filters["freelancerDetails.yearsOfExperience"].$gte =
//           parseInt(minExperience);
//       if (maxExperience)
//         filters["freelancerDetails.yearsOfExperience"].$lte =
//           parseInt(maxExperience);
//     }

//     // Hourly rate filter
//     if (minRate || maxRate) {
//       filters["freelancerDetails.hourlyRate"] = {};
//       if (minRate)
//         filters["freelancerDetails.hourlyRate"].$gte = parseFloat(minRate);
//       if (maxRate)
//         filters["freelancerDetails.hourlyRate"].$lte = parseFloat(maxRate);
//     }

//     const [total, freelancers] = await Promise.all([
//       User.countDocuments(filters),
//       User.find(filters)
//         .select({
//           email: 1,
//           status: 1,
//           profile: 1,
//           freelancerDetails: 1,
//         })
//         .skip(skip)
//         .limit(limit),
//     ]);

//     return res.status(200).json({
//       total,
//       page,
//       pages: Math.ceil(total / limit),
//       results: freelancers.length,
//       freelancers,
//     });
//   } catch (err) {
//     console.error("❌ Error fetching freelancers:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// const bookmarkFreelancer = async (req, res) => {
//   try {
//     const employerId = req.user._id;
//     const freelancerId = req.params.id;

//     // Validation: Valid ObjectId
//     if (!mongoose.Types.ObjectId.isValid(freelancerId)) {
//       return res.status(400).json({ message: "Invalid freelancer ID" });
//     }

//     // Cannot bookmark self
//     if (employerId.toString() === freelancerId.toString()) {
//       return res.status(403).json({ message: "You cannot bookmark yourself" });
//     }

//     // Atomically add to employer's bookmarkedFreelancers if not already present
//     const updatedEmployer = await User.findOneAndUpdate(
//       {
//         _id: employerId,
//         role: { $in: ["employer"] },
//         "employerDetails.bookmarkedFreelancers": { $ne: freelancerId }, // not already bookmarked
//       },
//       {
//         $addToSet: {
//           "employerDetails.bookmarkedFreelancers": freelancerId,
//         },
//       },
//       { new: true }
//     );

//     // If update didn't happen (already bookmarked or invalid employer)
//     if (!updatedEmployer) {
//       return res
//         .status(409)
//         .json({ message: "Freelancer already bookmarked or invalid employer" });
//     }

//     // Increment like count on freelancer (only if valid and is freelancer)
//     const updatedFreelancer = await User.findOneAndUpdate(
//       {
//         _id: freelancerId,
//         role: { $in: ["freelancer"] },
//       },
//       {
//         $inc: { "freelancerDetails.likeCount": 1 },
//       }
//     );

//     if (!updatedFreelancer) {
//       return res.status(404).json({ message: "Freelancer not found" });
//     }

//     return res.status(200).json({
//       message: "Freelancer bookmarked successfully",
//     });
//   } catch (error) {
//     console.error("❌ Error bookmarking freelancer:", error);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// const unbookmarkFreelancer = async (req, res) => {
//   const employerId = req.user?._id;
//   const freelancerId = req.params.id;

//   // Validate ID
//   if (!mongoose.Types.ObjectId.isValid(freelancerId)) {
//     return res.status(400).json({ message: "Invalid freelancer ID" });
//   }

//   // Prevent self-unbookmark
//   if (employerId.toString() === freelancerId.toString()) {
//     return res.status(403).json({ message: "You cannot unbookmark yourself" });
//   }

//   const employer = await User.findById(employerId);
//   if (!employer || !employer.role.includes("employer")) {
//     return res
//       .status(403)
//       .json({ message: "Only employers can unbookmark freelancers" });
//   }

//   const updatedEmployer = await User.findOneAndUpdate(
//     {
//       _id: employerId,
//       role: { $in: ["employer"] },
//       "employerDetails.bookmarkedFreelancers": freelancerId,
//     },
//     {
//       $pull: { "employerDetails.bookmarkedFreelancers": freelancerId },
//     },
//     { new: true }
//   );

//   if (!updatedEmployer) {
//     return res
//       .status(404)
//       .json({ message: "Freelancer not found in bookmarks or unauthorized" });
//   }

//   // Decrement like count atomically
//   await User.updateOne(
//     { _id: freelancerId },
//     { $inc: { "freelancerDetails.likeCount": -1 } }
//   );

//   return res.status(200).json({
//     message: "Freelancer unbookmarked successfully",
//   });
// };

export {
  creatFreelancerProfile,
  getFreelancerProfile,
  // enableFreelancerProfile,
  // addFreelanceProfile,
  // editFreelanceProfile,
  // getFreelancerProfileById,
  // getAllFreelancers,
  // bookmarkFreelancer,
  // unbookmarkFreelancer,
};
