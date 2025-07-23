import mongoose from "mongoose";
import dotenv from "dotenv";
import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import calculateJobMatchPercentage from "../utils/calculate-job-match.js";
import Offer from "../database/models/offers.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";

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
});

// Controllers
const creatJobSeekerProfile = async (req, res) => {
  const data = createProfileZODSchema.parse(req.body);
  try {
    const userId = req.user._id;
    if (!userId) {
      return res.status(403).json({ message: "Invalid User" });
    }

    const user = await JOBSEEKER.findById(userId);
    if (!user) {
      return res.status(403).json({ message: "No User found!" });
    }

    if (user.profile) {
      return res.status(403).json({ message: "Profile already set" });
    }

    user.profile = data;
    user.profile.freelancerWork = data.freelancerWork === "true";
    if (req.file && req.newName) {
      user.profilePictureUrl = `${req.newName.replace(/\\/g, "/")}`;
    }

    await user.save();

    return res.status(201).json({ message: "Profile created successfully" });
  } catch (err) {
    console.log("❌ Error creating User profile: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Get Profile
const getJobSeekerProfile = async (req, res) => {
  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(403).json({ message: "Invalid User" });
    }

    const user = await JOBSEEKER.findOne(
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
      return res.status(404).json({ message: "USER profile not set" });
    }

    const data = {
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      ...user.profile,
      profilePictureUrl: user.profilePictureUrl,
    };
    data.jobActivity.profileViews =
      user.profile?.jobActivity?.profileViews?.length;

    return res.status(200).json({
      user: data,
    });
  } catch (err) {
    console.log("❌ Error getting profile: ", err);
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
const editJobSeekerProfile = async (req, res) => {
  const data = updateProfileZODSchema.parse(req.body);

  try {
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "User invalid" });
    }
    const user = await JOBSEEKER.findOne({
      _id: userId,
      status: { $nin: ["deleted"] },
    });

    if (user.status == "suspended") {
      return res.status(403).json({ message: "Account cannot be modified" });
    }

    const existing = await JOBSEEKER.findOne({
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
    console.log("❌ Error getting profile: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Job Stats
const getUserJobStats = async (req, res) => {
  try {
    const userId = req.user?._id;
    const job = req.query.job || "simple";

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Get all jobs the user has applied to
    const user = await JOBSEEKER.findById(userId);
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
      job: job,
      status: "empty",
      deadline: { $gt: new Date() },
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

// Profile
const getDashboardData = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user id" });
    }

    const user = await JOBSEEKER.findById(userId);
    if (!user || user.status == "deleted") {
      return res.status(401).json({ message: "No user found" });
    }

    const offers = await Offer.find({ senderId: userId }).select("createdAt");
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const lastWeekOffers = offers.filter(
      (e) => new Date(e.createdAt) >= oneWeekAgo
    );

    const transformedData = {
      applications: offers.length || 0,
      newApplications: lastWeekOffers.length || 0,
      savedJobs: user.savedJobs.length || 0,
      views: user.profile.jobActivity?.profileViews?.length || 0,
      activity: user.activity,
      fullName: user.fullName,
    };

    return res.status(200).json({ data: transformedData });
  } catch (err) {
    console.error("❌ Error geting Earning info:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// get Public profile
const getJobSeekerProfileById = async (req, res) => {
  try {
    const userId = req.params.id;
    const viewerId = req.params.id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(403).json({ message: "Invalid User" });
    }

    const user = await JOBSEEKER.findOne(
      { _id: userId, status: { $nin: ["deleted"] } },
      {
        fullName: 1,
        profilePictureUrl: 1,
        profile: 1,
      }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.profile) {
      return res.status(404).json({ message: "User profile not set" });
    }

    if (viewerId && mongoose.Types.ObjectId.isValid(viewerId)) {
      if (!user.profile.jobActivity.profileViews.includes(viewerId)) {
        user.profile.jobActivity.profileViews = [
          ...user.profile.jobActivity.profileViews,
          viewerId,
        ];

        await user.save();
      }
    }

    const data = {
      fullName: user.fullName,
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

// get all JobSeekers
const getJobSeekerList = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const text = req.query.text?.trim() || "";
    const skill = req.query.skill?.trim();
    const experience = parseInt(req.query.experience) || 0;
    const budget = parseInt(req.query.budget) || 0;
    const maxBudget = parseInt(req.query.maxBudget) || 0;
    const userId = req.user?._id;

    const filter = {
      status: "active",
      profile: { $exists: true },
      "profile.professionalTitle": { $exists: true },
      "profile.skills": { $exists: true, $ne: [] },
    };

    // Text search on name, title or bio
    if (text) {
      const terms = text
        .split(" ")
        .filter(Boolean)
        .map((term) => new RegExp(term, "i"));
      filter.$or = [
        { fullName: { $in: terms } },
        { "profile.professionalTitle": { $in: terms } },
        { "profile.bio": { $in: terms } },
        { "profile.skills": { $in: terms } },
      ];
    }

    if (skill) {
      filter["profile.skills"] = skill;
    }

    if (budget > 0 && maxBudget > 0) {
      filter["profile.hourlyRate"] = { $gte: budget, $lte: maxBudget };
    } else if (budget > 0) {
      filter["profile.hourlyRate"] = { $gte: budget };
    } else if (maxBudget > 0) {
      filter["profile.hourlyRate"] = { $lte: maxBudget };
    }

    let users = await JOBSEEKER.find(filter)
      .select([
        "_id",
        "fullName",
        "lastOnline",
        "profile.professionalTitle",
        "profile.skills",
        "profile.experiences",
        "profile.profilePictureUrl",
        "profile.badge",
        "profile.hourlyRate",
        "profile.loaction",
        "profile.projects",
        "rating",
        "likedBy",
      ])
      .skip(skip)
      .limit(limit)
      .lean();

    if (experience > 0) {
      users = users.filter((f) => {
        const totalExpYears = (f.profile.experiences || []).reduce(
          (acc, exp) => {
            const start = new Date(exp.startDate);
            const end = exp.isCurrentJob
              ? new Date()
              : new Date(exp.endDate || new Date());
            const diffYears =
              (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
            return acc + (diffYears > 0 ? diffYears : 0);
          },
          0
        );

        // Apply range filtering
        if (experience === 1) return totalExpYears < 2; // Basic
        if (experience === 2) return totalExpYears >= 2 && totalExpYears <= 5; // Intermediate
        if (experience === 3) return totalExpYears > 5; // Expert

        return true;
      });
    }

    const formatted = users.map((f) => {
      const experienceYears = (f.profile.experiences || []).reduce(
        (acc, exp) => {
          const start = new Date(exp.startDate);
          const end = exp.isCurrentJob
            ? new Date()
            : new Date(exp.endDate || new Date());
          const years =
            (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
          return acc + (years > 0 ? years : 0);
        },
        0
      );

      return {
        _id: f._id,
        fullName: f.fullName,
        professionalTitle: f.profile?.professionalTitle || "",
        skills: f.profile?.skills || [],
        experience: Math.floor(experienceYears),
        profilePictureUrl: f.profile?.profilePictureUrl || "",
        badge: f.profile?.badge,
        rated: f.rating.isRated,
        lastOnline: f.lastOnline,
        rating: f.rating?.value || 0,
        totalRating: f.rating?.totalRatings || 0,
        startPrice: f.profile?.hourlyRate || 0,
        location: f.profile?.loaction || "",
        projectsCompleted: f.profile?.projects?.length || 0,
        liked: f.likedBy?.includes(userId?.toString()) || false,
      };
    });

    return res.json({ users: formatted });
  } catch (err) {
    console.error("❌ Failed to fetch users:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

export {
  creatJobSeekerProfile,
  getJobSeekerProfile,
  editJobSeekerProfile,
  getUserJobStats,
  getDashboardData,
  getJobSeekerList,
  getJobSeekerProfileById,
};
