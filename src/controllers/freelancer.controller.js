import mongoose from "mongoose";
import User from "../database/models/users.model.js";
import dotenv from "dotenv";
import { z } from "zod";
import { jwtToken } from "../utils/jwt.js";
import FREELANCER from "../database/models/freelancer.model.js";
import uploadProfile from "../utils/files/uploadProfile.js";
import Job from "../database/models/jobs.model.js";
import calculateJobMatchPercentage from "../utils/calculate-job-match.js";
import {
  createStripeExpressAcount,
  generateOnBoardingAccountLink,
} from "../services/stripe.service.js";

dotenv.config();

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
        phoneNumber: 1,
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
      phoneNumber: user.phoneNumber,
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
const updateProfileZODSchema = z.object({
  fullName: z.string().min(1, "Full name is reuired min 1 chracter"),
  professionalTitle: z
    .string()
    .min(5, "Min 5 chracter required")
    .max(200, "Max 200 chracters allowed"),
  loaction: z.string().min(2, "Location reuired with min 2 chracters"),
  website: z.string().optional(),
  bio: z
    .string()
    .min(10, "At least 10 chracters required")
    .max(2000, "Max 2000 chracters allowed"),
  email: z.string().email("Invalid email format"),
  phone: z
    .string()
    .min(11, "Min 11 chracters allowed")
    .max(15, "Max 15 chracters allowed"),
  skills: z.array(z.string()).min(1, "At lease 1 skill required"),
  experiences: z.array(z.string()).optional(),
});
const editFreelanceProfile = async (req, res, next) => {
  const data = updateProfileZODSchema.parse(req.body);

  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "User invalid" });
    }
    const user = await FREELANCER.findOne({
      _id: userId,
      status: { $nin: ["deleted"] },
    });

    if (user.status == "suspended") {
      return res.status(403).json({ message: "Account cannot be modified" });
    }

    const existing = await FREELANCER.findOne({
      email: data.email,
    });
    if (existing && userId != existing._id) {
      return res.status(403).json({ message: "Email not availble" });
    }

    const banner = req.files["banner"]?.[0];
    const profilePic = req.files["profile"]?.[0];

    if (banner) {
      user.profile.bannerUrl =
        process.env.BACKEND_URL + "/images/" + banner.filename;
    }
    if (profilePic) {
      user.profilePictureUrl =
        process.env.BACKEND_URL + "/images/" + profilePic.filename;
    }
    let parsedExps = [];
    if (data.experiences) {
      parsedExps = data.experiences.map((exp) => JSON.parse(exp));
    }

    user.email = data.email;
    user.phoneNumber = data.phone;
    user.profile.professionalTitle = data.professionalTitle;
    user.profile.loaction = data.loaction;
    user.profile.website = data.website;
    user.profile.bio = data.bio;
    user.profile.skills = data.skills;
    user.profile.experiences = parsedExps;

    await user.save();
    return res.status(200).json({ message: "Profile updated successfully" });
  } catch (err) {
    console.log("❌ Error getting freelance profile: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Job Stats
const getUserJobStats = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Get all jobs the user has applied to
    const user = await FREELANCER.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "User not found!" });
    }

    // Get count of saved jobs
    const savedJobs = user.savedJobs || [];
    const savedCount = savedJobs.length;

    // Get count of applied jobs
    const applied = await Job.find({
      status: "empty",
      applicants: { $in: [new mongoose.Types.ObjectId(userId)] },
      deadline: { $gt: new Date() },
      "simpleJobDetails.deadline": { $gt: new Date() },
    }).select("_id");
    const appliedCount = applied.length;

    // Suggested jobs — based on recent active jobs the user hasn’t applied/saved
    const appliedJobIds = applied.map((job) => job._id);
    const savedJobIds = savedJobs.map((entry) => entry);

    const excludedJobIds = Array.from(
      new Set([...appliedJobIds, ...savedJobIds])
    );

    const suggestions = await Job.find({
      _id: { $nin: excludedJobIds },
      status: "empty",
      deadline: { $gt: new Date() },
      "simpleJobDetails.deadline": { $gt: new Date() },
    })
      .limit(2)
      .select("_id title description")
      .populate("employerId", "fullName");

    const tempSuggestions = suggestions.map((e) => ({
      _id: e._id,
      title: e.title,
      company: e.employerId.fullName,
      match: calculateJobMatchPercentage(
        {
          title: e.title,
          description: e.description,
        },
        {
          bio: user.profile.bio,
          skills: user.profile.skills,
        }
      ),
    }));

    return res.status(200).json({
      suggestions: tempSuggestions,
      appliedCount,
      savedCount,
    });
  } catch (err) {
    console.error("❌ Error in getUserJobStats:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Get Earning
const getFreelancerEarnings = async (req, res) => {
  try {
    const userId = req.user?._id;

    const user = await FREELANCER.findById(userId);
    if (!userId) {
      return res.status(401).json({ message: "User not found!" });
    }

    if (user.onboarded === false) {
      return res.status(200).json({
        message: "Please setupe Payment first in Earnings tab",
        onboardRequired: true,
      });
    }

    return res.status(200).json({ message: "need to be implemented" });
  } catch (err) {
    console.error("❌ Error geeting Earning info:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// start onboarding
const startFreelancerOnboarding = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Inavlid User" });
    }

    const user = await FREELANCER.findById(userId);
    if (!user || user.status == "deleted") {
      return res.status(401).json({ message: "User not found1" });
    }

    if (user.status == "suspended") {
      return res
        .status(400)
        .json({ message: "Suspended Accounts cannot be onboarded" });
    }

    if (user.onboarded === true) {
      return res
        .status(400)
        .json({ message: "User has completed onboarding process" });
    }

    try {
      if (!user.stripeAccountId) {
        const account = await createStripeExpressAcount(user.email);
        user.stripeAccountId = account.id;
        await user.save();
      }

      const link = await generateOnBoardingAccountLink(
        user.stripeAccountId,
        process.env.STRIPE_REFRESH_URL,
        process.env.STRIPE_RETURN_URL
      );

      return res.status(200).json({ url: link.url });
    } catch (err) {
      console.log("❌ Error creating stripe account: " + err);
      return res.status(400).json({ message: "Error creating stripe account" });
    }
  } catch (err) {
    console.error("❌ Error geting Earning info:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// check onboarding
const checkOnboared = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Inavlid User" });
    }

    const user = await FREELANCER.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "User Not found!" });
    }

    if (user.onboarded === true) {
      return res
        .status(200)
        .json({ message: "Account is onboarded", onboarded: true });
    } else {
      return res
        .status(200)
        .json({ message: "Account is onboarded", onboarded: false });
    }
  } catch (err) {
    console.error("❌ Error geting Earning info:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export {
  creatFreelancerProfile,
  getFreelancerProfile,
  editFreelanceProfile,
  getUserJobStats,
  getFreelancerEarnings,
  startFreelancerOnboarding,
  checkOnboared
  // enableFreelancerProfile,
  // addFreelanceProfile,
  // getFreelancerProfileById,
  // getAllFreelancers,
  // bookmarkFreelancer,
  // unbookmarkFreelancer,
};
