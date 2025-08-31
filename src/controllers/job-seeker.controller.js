import mongoose from "mongoose";
import dotenv from "dotenv";
import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import calculateJobMatchPercentage from "../utils/calculate-job-match.js";
import Offer from "../database/models/offers.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import EMPLOYER from "../database/models/employers.model.js";

dotenv.config();

const createProfileZODSchema = z.object({
  fullName: z.string().min(1, "Full name is reuired min 1 chracter"),
  profilePictureUrl: z.string().optional(),
  bannerUrl: z.string().optional(),
  resumeUrl: z.string().optional(),
  category: z.string(),
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
  phoneNumber: z
    .string()
    .min(11, "Min 11 chracters allowed")
    .max(15, "Max 15 chracters allowed"),
  skills: z.array(z.string()).min(1, "At lease 1 skill required"),
  experiences: z
    .array(
      z.object({
        jobTitle: z.string(),
        companyName: z.string(),
        jobType: z.enum([
          "Part-time",
          "Full-time",
          "Internship",
          "Freelance",
          "Contract",
        ]),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        jobLoaction: z.string(),
        isCurrentJob: z.boolean(),
        jobDescription: z.string(),
      })
    )
    .optional(),
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

    user.fullName = data.fullName;
    user.phoneNumber = data.phoneNumber;
    user.category = data.category;
    if (data.profilePictureUrl) {
      user.profilePictureUrl = data.profilePictureUrl;
    }
    if (data.bannerUrl) {
      user.profile.bannerUrl = data.bannerUrl;
    }
    if (data.resumeUrl) {
      user.profile.resumeUrl = data.resumeUrl;
    }
    user.profile.professionalTitle = data.professionalTitle;
    user.profile.bio = data.bio;
    user.profile.loaction = data.loaction;
    user.profile.website = data.website;
    user.profile.skills = data.skills;
    user.profile.experiences = data.experiences;
    await user.save();

    return res.status(201).json({ message: "Profile updated successfully" });
  } catch (err) {
    console.log("❌ Error creating User profile: ", err);
    return res
      .status(500)
      .json({ message: "Error updating job seeker profile" });
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
        category: 1,
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
      category: user.category,
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
// const updateProfileZODSchema = z.object({
//   fullName: z.string().min(1, "Full name is reuired min 1 chracter"),
//   profilePictureUrl: z.string().optional(),
//   bannerUrl: z.string().optional(),
//   professionalTitle: z
//     .string()
//     .min(5, "Min 5 chracter required")
//     .max(200, "Max 200 chracters allowed"),
//   loaction: z.string().min(2, "Location reuired with min 2 chracters"),
//   website: z.string().optional(),
//   bio: z
//     .string()
//     .min(10, "At least 10 chracters required")
//     .max(2000, "Max 2000 chracters allowed"),
//   phone: z
//     .string()
//     .min(11, "Min 11 chracters allowed")
//     .max(15, "Max 15 chracters allowed"),
//   skills: z.array(z.string()).min(1, "At lease 1 skill required"),
//   experiences: z.array(z.string()).optional(),
// });
// const editJobSeekerProfile = async (req, res) => {
//   const data = updateProfileZODSchema.parse(req.body);

//   try {
//     const userId = req.user?._id;

//     if (!userId) {
//       return res.status(401).json({ message: "User invalid" });
//     }
//     const user = await JOBSEEKER.findOne({
//       _id: userId,
//       status: { $nin: ["deleted"] },
//     });

//     if (user.status == "suspended") {
//       return res.status(403).json({ message: "Account cannot be modified" });
//     }

//     const existing = await JOBSEEKER.findOne({
//       email: data.email,
//     });
//     if (existing && userId != existing._id) {
//       return res.status(403).json({ message: "Email not availble" });
//     }

//     const banner = req.files["banner"]?.[0];
//     const profilePic = req.files["profile"]?.[0];

//     if (banner) {
//       user.profile.bannerUrl =
//         process.env.BACKEND_URL + "/images/" + banner.filename;
//     }
//     if (profilePic) {
//       user.profilePictureUrl =
//         process.env.BACKEND_URL + "/images/" + profilePic.filename;
//     }
//     let parsedExps = [];
//     if (data.experiences) {
//       parsedExps = data.experiences.map((exp) => JSON.parse(exp));
//     }

//     user.email = data.email;
//     user.phoneNumber = data.phone;
//     user.profile.professionalTitle = data.professionalTitle;
//     user.profile.loaction = data.loaction;
//     user.profile.website = data.website;
//     user.profile.bio = data.bio;
//     user.profile.skills = data.skills;
//     user.profile.experiences = parsedExps;

//     await user.save();
//     return res.status(200).json({ message: "Profile updated successfully" });
//   } catch (err) {
//     console.log("❌ Error getting profile: ", err);
//     return res.status(500).json({ message: "Server Error" });
//   }
// };

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
      "applicants.userId": { $in: [new mongoose.Types.ObjectId(userId)] },
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
      .select("_id title description category")
      .populate("employerId", "fullName");

    const tempSuggestions = suggestions.map((e) => ({
      _id: e._id,
      title: e.title,
      company: e.employerId.fullName,
      match: calculateJobMatchPercentage(
        {
          title: e.title,
          description: e.description,
          category:
            e.job === "freelance"
              ? e.freelanceJobDetails?.category
              : e.simpleJobDetails?.category,
        },
        {
          bio: user.profile.professionalTitle + user.profile.bio || " ",
          skills: user.profile.skills || [],
          category: user.category,
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
    const viewerId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(403).json({ message: "Invalid User" });
    }

    const user = await JOBSEEKER.findOne(
      { _id: userId },
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
      return res.status(404).json({ message: "User profile not set" });
    }

    if (
      viewerId &&
      viewerId != userId &&
      mongoose.Types.ObjectId.isValid(viewerId)
    ) {
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
      phoneNumber: user.phoneNumber,
      email: user.email,
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
    const experience = parseInt(req.query.experience?.trim()) || 0;
    const skill = req.query.skill?.trim() || "";
    const category = req.query.category?.trim() || "";
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const employer = await EMPLOYER.findById(userId);
    if (!employer) {
      return res.status(404).json({ message: "user not found!" });
    }

    if (
      !employer.currentSubscription ||
      new Date(employer.currentSubscription.end) < new Date()
    ) {
      return res.status(200).json({
        message: "subscription required",
        users: [],
        subscribed: false,
      });
    }

    const filter = {
      status: "active",
      profile: { $exists: true },
      // "profile.professionalTitle": { $exists: true },
      "profile.skills": { $exists: true, $ne: [] },
    };

    if (text) {
      const terms = text
        .split(" ")
        .filter(Boolean)
        .map((term) => new RegExp(term, "i"));

      filter.$or = terms.flatMap((term) => [
        { fullName: { $regex: term } },
        { "profile.professionalTitle": { $regex: term } },
        { "profile.bio": { $regex: term } },
        { "profile.skills": { $regex: term } },
      ]);
    }

    if (skill) {
      filter["profile.skills"] = skill;
    }

    if (category) {
      filter["category"] = category;
    }

    let users = await JOBSEEKER.find(filter)
      .select([
        "_id",
        "fullName",
        "profile.professionalTitle",
        "profile.skills",
        "profile.experiences",
        "profilePictureUrl",
        "profile.loaction",
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
      const experiences = (f.profile.experiences || []).map((e) => ({
        start: e.startDate,
        end: e.endDate,
        title: e.jobTitle,
      }));

      return {
        _id: f._id,
        fullName: f.fullName,
        resumeUrl: f.profile.resumeUrl,
        professionalTitle: f.profile?.professionalTitle || "",
        skills: f.profile?.skills || [],
        experiences: experiences || [],
        profilePictureUrl: f.profilePictureUrl || "",
        location: f.profile?.loaction || "",
        liked: f.likedBy?.includes(userId?.toString()) || false,
      };
    });

    return res.status(200).json({ users: formatted, subscribed: true });
  } catch (err) {
    console.error("❌ Failed to fetch users:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Like a freelancer
const likeJobSeeker = async (req, res) => {
  try {
    const jobSeekerId = req.params.id;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(jobSeekerId)) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const jobseeker = await JOBSEEKER.findById(jobSeekerId);
    if (!jobseeker) {
      return res.status(404).json({ message: "jobseeker not found" });
    }

    const alreadyLiked = jobseeker.likedBy.includes(userId.toString());

    if (alreadyLiked) {
      return res
        .status(400)
        .json({ message: "You already liked this jobseeker" });
    }

    jobseeker.likedBy.push(userId.toString());
    await jobseeker.save();

    return res.status(200).json({ message: "jobseeker liked successfully" });
  } catch (err) {
    console.error("Like error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// un Like
const unlikeJObSeeker = async (req, res) => {
  try {
    const jobseekerId = req.params.id;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(jobseekerId)) {
      return res.status(400).json({ message: "Invalid jobseeker ID" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const jobseeker = await JOBSEEKER.findById(jobseekerId);
    if (!jobseeker) {
      return res.status(404).json({ message: "Freelancer not found" });
    }

    const wasLiked = jobseeker.likedBy.includes(userId.toString());

    if (!wasLiked) {
      return res
        .status(400)
        .json({ message: "You haven't liked this jobseeker" });
    }

    jobseeker.likedBy = jobseeker.likedBy.filter(
      (id) => id !== userId.toString()
    );
    await jobseeker.save();

    return res.status(200).json({ message: "Like removed successfully" });
  } catch (err) {
    console.error("Unlike error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

export {
  creatJobSeekerProfile,
  getJobSeekerProfile,
  getUserJobStats,
  getDashboardData,
  getJobSeekerList,
  getJobSeekerProfileById,
  likeJobSeeker,
  unlikeJObSeeker,
};
