import mongoose, { mongo } from "mongoose";
import User from "../database/models/users.model.js";
import dotenv from "dotenv";
import { z } from "zod";
import { jwtToken } from "../utils/jwt.js";
import FREELANCER from "../database/models/freelancer.model.js";
import uploadProfile from "../utils/files/uploadProfile.js";
import Job from "../database/models/jobs.model.js";
import calculateJobMatchPercentage from "../utils/calculate-job-match.js";
import {
  createAccountOnbaordSession2,
  createStripeAccount2,
  createStripeExpressAcount,
  generateOnBoardingAccountLink,
  generateStipeLoginLink,
  getExternalAccounts,
  getStripeBalanceByAccountId,
  retriveStripeAccount,
} from "../services/stripe.service.js";
import Offer from "../database/models/offers.model.js";
import Order from "../database/models/order.model.js";
import TRANSACTION from "../database/models/transactions.model.js";
import { getMemorySubscriptionns } from "./subscriptions.controller.js";
import puppeteer from "puppeteer";

dotenv.config();
const BACKEND_URL = process.env.BACKEND_URL;

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
  loaction: z.string().optional(),
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

    // if (freelancer.profile) {
    //   return res.status(403).json({ message: "Profile already set" });
    // }

    freelancer.profile = data;
    freelancer.profile.freelancerWork = data.freelancerWork === "true";
    if (req.file && req.newName) {
      freelancer.profilePictureUrl =
        BACKEND_URL + "/" + `${req.newName.replace(/\\/g, "/")}`;
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
        profilePictureUrl: 1,
        profile: 1,
        rating: 1,
        projectsCompleted: 1,
        createdAt: 1,
      }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.profile) {
      return res.status(404).json({ message: "Freelancer profile not set" });
    }

    const data = {
      _id: user._id,
      fullName: user.fullName,
      ...user.profile,
      profilePictureUrl: user.profilePictureUrl,
      rating: user.rating,
      projectsCompleted: user.projectsCompleted,
      createdAt: user.createdAt,
    };
    data.jobActivity.profileViews =
      user.profile?.jobActivity?.profileViews?.length;

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
    const userId = req.user?._id;
    const job = req.query.job || "simple";

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

    let withdrawlMethods;
    try {
      const { bank, card } = await getExternalAccounts(user.stripeAccountId);
      withdrawlMethods = {
        bank,
        card,
      };
    } catch (err) {
      console.log(
        "Error getting external accounts for user: ",
        userId,
        " ",
        err
      );
    }

    const data = {
      currentBalance: user.currentBalance.toFixed(1),
      totalEarning: user.totalEarning.toFixed(1),
      pending: user.pendingClearence.toFixed(1),
      tip: user.tip.toFixed(1),
      withdrawlMethods,
    };

    return res.status(200).json({ message: "Data Fetched", data });
  } catch (err) {
    console.error("❌ Error geeting Earning info:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// start onboarding

const onboardConnectedAccountSchema = z.object({
  phone: z.string().min(8),
  ssn: z.string().length(4, "SSN number is of 4 chracters only").optional(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.object({
    day: z.coerce.number().min(1).max(31),
    month: z.coerce.number().min(1).max(12),
    year: z.coerce.number().min(1900).max(new Date().getFullYear()),
  }),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    postal_code: z.string().min(4),
    country: z.string().length(2),
  }),
});

const startFreelancerOnboarding = async (req, res) => {
  const data = onboardConnectedAccountSchema.parse(req.body);
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
        const individual = {
          first_name: data.firstName,
          last_name: data.lastName,
          phone: data.phone,
          dob: data.dob,
          email: user.email,
          address: data.address,
        };
        if (data.address.country == "US") {
          individual.ssn_last_4 = data.ssn;
        }
        const tos_acceptance = {
          date: Math.floor(Date.now() / 1000),
          ip: req.ip, // IP address of the user
        };

        // console.log("individual: ", individual)

        const account = await createStripeExpressAcount({
          email: user.email,
          business_type: "individual",
          individual: individual,
          tos_acceptance: tos_acceptance,
          country: data.address.country,
        });
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
      return res
        .status(400)
        .json({ message: "Error creating stripe account " + err });
    }
  } catch (err) {
    console.error("❌ Error geting Earning info:", err);
    return res.status(500).json({ message: "Error creating account: " + err });
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

// Profile
const getDashboardData = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user id" });
    }

    const user = await FREELANCER.findById(userId);
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
const getFreelanceProfileById = async (req, res) => {
  try {
    const userId = req.params.id;
    const viewerId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(403).json({ message: "Invalid User" });
    }

    const user = await FREELANCER.findOne(
      { _id: userId, status: { $nin: ["deleted"] } },
      {
        fullName: 1,
        profilePictureUrl: 1,
        profile: 1,
        rating: 1,
        projectsCompleted: 1,
        createdAt: 1,
      }
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.profile) {
      return res.status(404).json({ message: "Freelancer profile not set" });
    }

    console.log("user: ", userId);
    console.log("view: ", viewerId);
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
      _id: user._id,
      fullName: user.fullName,
      ...user.profile,
      profilePictureUrl: user.profilePictureUrl,
      rating: user.rating,
      projectsCompleted: user.projectsCompleted,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      user: data,
    });
  } catch (err) {
    console.log("❌ Error getting freelance profile: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get all Freelancer
const getFreelancerList = async (req, res) => {
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
      "profile.freelancerWork": true,
    };

    // Text search on name, title or bio
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

    if (budget > 0 && maxBudget > 0) {
      filter["profile.hourlyRate"] = { $gte: budget, $lte: maxBudget };
    } else if (budget > 0) {
      filter["profile.hourlyRate"] = { $gte: budget };
    } else if (maxBudget > 0) {
      filter["profile.hourlyRate"] = { $lte: maxBudget };
    }

    let freelancers = await FREELANCER.find(filter)
      .select([
        "_id",
        "fullName",
        "lastOnline",
        "projectsCompleted",
        "profile.professionalTitle",
        "profile.skills",
        "profile.experiences",
        "profilePictureUrl",
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
      freelancers = freelancers.filter((f) => {
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

    const formatted = freelancers.map((f) => {
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
        profilePictureUrl: f.profilePictureUrl || "",
        badge: f.profile?.badge,
        rated: f.rating.isRated,
        lastOnline: f.lastOnline,
        rating: f.rating?.value || 0,
        totalRating: f.rating?.totalRatings || 0,
        startPrice: f.profile?.hourlyRate || 0,
        location: f.profile?.loaction || "",
        projectsCompleted: f.projectsCompleted || 0,
        liked: f.likedBy?.includes(userId?.toString()) || false,
      };
    });

    return res.json({ freelancers: formatted });
  } catch (err) {
    console.error("❌ Failed to fetch freelancers:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Like a freelancer
const likeFreelancer = async (req, res) => {
  try {
    const freelancerId = req.params.id;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(freelancerId)) {
      return res.status(400).json({ message: "Invalid freelancer ID" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const freelancer = await FREELANCER.findById(freelancerId);
    if (!freelancer) {
      return res.status(404).json({ message: "Freelancer not found" });
    }

    const alreadyLiked = freelancer.likedBy.includes(userId.toString());

    if (alreadyLiked) {
      return res
        .status(400)
        .json({ message: "You already liked this freelancer" });
    }

    freelancer.likedBy.push(userId.toString());
    await freelancer.save();

    return res.status(200).json({ message: "Freelancer liked successfully" });
  } catch (err) {
    console.error("Like error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// un Like
const unlikeFreelancer = async (req, res) => {
  try {
    const freelancerId = req.params.id;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(freelancerId)) {
      return res.status(400).json({ message: "Invalid freelancer ID" });
    }

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const freelancer = await FREELANCER.findById(freelancerId);
    if (!freelancer) {
      return res.status(404).json({ message: "Freelancer not found" });
    }

    const wasLiked = freelancer.likedBy.includes(userId.toString());

    if (!wasLiked) {
      return res
        .status(400)
        .json({ message: "You haven't liked this freelancer" });
    }

    freelancer.likedBy = freelancer.likedBy.filter(
      (id) => id !== userId.toString()
    );
    await freelancer.save();

    return res.status(200).json({ message: "Like removed successfully" });
  } catch (err) {
    console.error("Unlike error:", err);
    return res.status(500).json({ message: "Something went wrong" });
  }
};

// Payment history for order
const getFreelancerPaymentHistory = async (req, res) => {
  try {
    const freelancerId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(freelancerId)) {
      return res.status(401).json({ message: "Invalid Freelancer" });
    }

    const freelancer = await FREELANCER.findById(freelancerId);
    if (!freelancer || freelancer.status === "deleted") {
      return res.status(401).json({ message: "User not found!" });
    }
    if (freelancer.onboarded !== true) {
      return res.status(200).json({ onboardRequired: true });
    }

    const orders = await Order.find({
      freelancerId: freelancerId,
      status: { $in: ["completed", "in_progress", "in_revision", "delivered"] },
    })
      .populate("transactionId", "orderDeatils")
      .sort({
        createdAt: -1,
      });

    const transformed = orders.map((e) => ({
      title: e.title,
      status:
        e.transactionId.orderDeatils.status == "escrow_held"
          ? "pending"
          : e.transactionId.orderDeatils.status == "released_to_freelancer"
          ? "completed"
          : null,
      amount: e.transactionId.orderDeatils.amountToBePaid,
      tip: e.transactionId.orderDeatils.tip,
      date: e.createdAt,
    }));

    return res.status(200).json({ data: transformed });
  } catch (err) {
    console.error("❌ Error getting payment History:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get Monthly Earning History
const getMonthlyEarningsByFreelancer = async (req, res) => {
  try {
    const freelancerId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(freelancerId)) {
      return res.status(401).json({ message: "Invalid Freelancer" });
    }

    const freelancer = await FREELANCER.findById(freelancerId);
    if (!freelancer || freelancer.status === "deleted") {
      return res.status(401).json({ message: "User not found!" });
    }
    if (freelancer.onboarded !== true) {
      return res.status(200).json({ onboardRequired: true });
    }

    // Get current year
    const year = new Date().getFullYear();

    const monthlyData = await TRANSACTION.aggregate([
      {
        $match: {
          "orderDeatils.freelancerId": new mongoose.Types.ObjectId(
            freelancerId
          ),
          mode: "order",
          createdAt: {
            $gte: new Date(`${year}-01-01T00:00:00.000Z`),
            $lte: new Date(`${year}-12-31T23:59:59.999Z`),
          },
        },
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          totalAmount: { $sum: "$orderDeatils.amountToBePaid" },
          orders: { $sum: 1 },
        },
      },
      {
        $sort: { _id: 1 },
      },
    ]);

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const result = monthNames.map((name, index) => {
      const data = monthlyData.find((m) => m._id === index + 1);
      return {
        month: name,
        totalAmount: data ? data.totalAmount : 0,
        orders: data ? data.orders : 0,
      };
    });

    return res.status(200).json({ data: result });
  } catch (err) {
    console.error("❌ Error in getMonthlyEarningsByFreelancer:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

const getStripeFreelancerLogin = async (req, res) => {
  try {
    const freelancerId = req.user?._id;

    if (!freelancerId) {
      return res.status(400).json({ message: "freelancerId is required" });
    }

    const freelancer = await FREELANCER.findById(freelancerId);
    if (!freelancer) {
      return res.status(401).json({ message: "User not found" });
    }

    let link;
    try {
      link = await generateStipeLoginLink(freelancer.stripeAccountId);
    } catch (err) {
      console.log(
        "Error in generating stripe login for user: " + err,
        freelancerId
      );
    }

    if (!link) {
      return res.status(500).json({ message: "Error generating link" });
    }

    return res.status(200).json({ url: link.url });
  } catch (err) {
    console.error("❌ Error in getting stripe login link:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// check if paid for resume
const checkPaidForResume = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    const user = await FREELANCER.findById(userId);
    if (user.status != "active") {
      return res.status(400).json({
        message: "Only Active Freelancers are allowed to build resumes",
      });
    }

    const hasPaid = user.canDownloadResume === true;
    if (hasPaid) {
      return res.status(200).json({ hasPaid, amount: null });
    }

    const allPlans = await getMemorySubscriptionns();
    const plan = allPlans.find((e) => e.mode === "resume");
    if (!plan) {
      return res.status(400).json({ message: "No Plan Avaiable" });
    }
    if (!plan.isActive) {
      return res.status(400).json({ message: "Resume downloads are paused" });
    }

    const balance = await getStripeBalanceByAccountId(user.stripeAccountId);
    const availableBalance =
      balance.available.find((b) => b.currency === "usd")?.amount || 0;
    const canPay = availableBalance >= plan.price * 100;

    return res.status(200).json({ hasPaid, amount: plan.price, canPay });
  } catch (err) {
    console.log("❌ Erro checking if user has paid for resume: ", err);
    return res.status(500).json({ message: err });
  }
};

// pay for resume from freelancer balance
// const downLoadResume = async (req, res) => {
//   try {
//     const userId = req.user?._id;
//     const { html } = req.body;

//     if (!html || !userId) {
//       return res.status(400).json({ message: "Missing data" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ message: "Invalid User" });
//     }

//     const user = await FREELANCER.findById(userId).select(
//       "status canDownloadResume createdResumes"
//     );
//     if (!user || user.status !== "active") {
//       return res.status(400).json({ message: "Invalid User" });
//     }

//     if (user.canDownloadResume === true) {
//       const browser = await puppeteer.launch({
//         headless: "new",
//         args: ["--no-sandbox", "--disable-setuid-sandbox"],
//       });
//       const page = await browser.newPage();
//       const tailwindCDN = `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`;

//       await page.setContent(
//         `
//         <!DOCTYPE html>
//         <html>
//           <head>${tailwindCDN}</head>
//            <body style="height: 100%; margin: 0;">
//               ${html}
//             </body>
//         </html>
//         `,
//         {
//           waitUntil: "networkidle0",
//         }
//       );
//       const pdfBuffer = await page.pdf({
//         format: "A4",
//         printBackground: true,
//         // margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
//       });
//       await browser.close();

//       // TO-DO save resume to user
//       if (!user.createdResumes) user.createdResumes = [];
//       user.createdResumes.push({
//         title: `${Date.now()}-${user._id}-resume.pdf`,
//         url: "",
//       });
//       user.canDownloadResume = false;
//       await user.save();

//       // ✅ Send PDF buffer as response
//       res.set({
//         "Content-Type": "application/pdf",
//         "Content-Disposition": 'attachment; filename="resume.pdf"',
//       });

//       return res.send(pdfBuffer);
//     } else {
//       return res
//         .status(400)
//         .json({ message: "Resume can be downloaded after payment" });
//     }
//   } catch (err) {
//     console.log("❌ Error downloading: ", err);
//     return res.status(500).json({ message: "Error downloading " + err });
//   }
// };
const downLoadResume = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { html } = req.body;

    if (!html || !userId) {
      return res.status(400).json({ message: "Missing data" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User" });
    }

    const user = await FREELANCER.findById(userId).select(
      "status canDownloadResume createdResumes"
    );
    if (!user || user.status !== "active") {
      return res.status(400).json({ message: "Invalid User" });
    }

    if (user.canDownloadResume === true) {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      const tailwindCDN = `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`;

      await page.setContent(
        `
        <!DOCTYPE html>
        <html>
          <head>${tailwindCDN}</head>
          <body style="margin:0; padding:0;">
            <div id="resume-wrapper" style="width:100%;">
              ${html}
            </div>
          </body>
        </html>
        `,
        { waitUntil: "networkidle0" }
      );

      // Measure actual rendered height in px
      const contentHeightPx = await page.evaluate(() => {
        const el = document.getElementById("resume-wrapper");
        return el ? el.scrollHeight : document.body.scrollHeight;
      });

      // Convert px → mm
      const contentHeightMM = contentHeightPx * 0.264583;

      // Generate PDF exactly to that size
      const pdfBuffer = await page.pdf({
        printBackground: true,
        width: "210mm", // A4 width
        height: `${contentHeightMM}mm`, // Exact content height
        pageRanges: "1", // force only 1 page
      });

      await browser.close();

      // Save to DB
      if (!user.createdResumes) user.createdResumes = [];
      user.createdResumes.push({
        title: `${Date.now()}-${user._id}-resume.pdf`,
        url: "",
      });
      user.canDownloadResume = false;
      await user.save();

      // Send file
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="resume.pdf"',
      });

      return res.send(pdfBuffer);
    } else {
      return res
        .status(400)
        .json({ message: "Resume can be downloaded after payment" });
    }
  } catch (err) {
    console.log("❌ Error downloading: ", err);
    return res.status(500).json({ message: "Error downloading " + err });
  }
};

// check paid for cover letter
const checkPaidForCoverLetter = async (req, res) => {
  try {
    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    const user = await FREELANCER.findById(userId);
    if (user.status != "active") {
      return res.status(400).json({
        message: "Only Active Freelancers are allowed to build resumes",
      });
    }

    const hasPaid = user.canDownloadCover === true;
    if (hasPaid) {
      return res.status(200).json({ hasPaid, amount: null });
    }

    const allPlans = await getMemorySubscriptionns();
    const plan = allPlans.find((e) => e.mode === "cover");
    if (!plan) {
      return res.status(400).json({ message: "No Plan Avaiable" });
    }
    if (!plan.isActive) {
      return res.status(400).json({ message: "Cover downloads are paused" });
    }

    const balance = await getStripeBalanceByAccountId(user.stripeAccountId);
    const availableBalance =
      balance.available.find((b) => b.currency === "usd")?.amount || 0;
    const canPay = availableBalance >= plan.price * 100;

    return res.status(200).json({ hasPaid, amount: plan.price, canPay });
  } catch (err) {
    console.log("❌ Erro checking if user has paid for cover: ", err);
    return res.status(500).json({ message: err });
  }
};

// downlaod cover
// const downLoadCover = async (req, res) => {
//   try {
//     const userId = req.user?._id;
//     const { html } = req.body;

//     if (!html || !userId) {
//       return res.status(400).json({ message: "Missing data" });
//     }

//     if (!mongoose.Types.ObjectId.isValid(userId)) {
//       return res.status(400).json({ message: "Invalid User" });
//     }

//     const user = await FREELANCER.findById(userId).select(
//       "status canDownloadCover createdCovers"
//     );
//     if (!user || user.status !== "active") {
//       return res.status(400).json({ message: "Invalid User" });
//     }

//     if (user.canDownloadCover === true) {
//       const browser = await puppeteer.launch({
//         headless: "new",
//         args: ["--no-sandbox", "--disable-setuid-sandbox"],
//       });
//       const page = await browser.newPage();
//       const tailwindCDN = `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`;

//       await page.setContent(
//         `
//         <!DOCTYPE html>
//         <html>
//           <head>${tailwindCDN}</head>
//            <body style="height: 100%; margin: 0;">
//               ${html}
//             </body>
//         </html>
//         `,
//         {
//           waitUntil: "networkidle0",
//         }
//       );
//       const pdfBuffer = await page.pdf({
//         format: "A4",
//         printBackground: true,
//         // margin: { top: "20px", bottom: "20px", left: "20px", right: "20px" },
//       });
//       await browser.close();

//       // TO-DO upload file and get url
//       user.canDownloadCover = false;
//       user.createdCovers = [
//         ...(user.createdCovers || []),
//         {
//           title: `${Date.now()}-${user._id}-cover.pdf`,
//           url: "no",
//         },
//       ];
//       user.markModified("createdCovers");
//       await user.save();

//       res.set({
//         "Content-Type": "application/pdf",
//         "Content-Disposition": 'attachment; filename="cover_letter.pdf"',
//       });

//       return res.send(pdfBuffer);
//     } else {
//       return res
//         .status(400)
//         .json({ message: "Cover Letter can be downloaded after payment" });
//     }
//   } catch (err) {
//     console.log("❌ Error downloading: ", err);
//     return res.status(500).json({ message: "Error downloading : " + err });
//   }
// };
const downLoadCover = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { html } = req.body;

    if (!html || !userId) {
      return res.status(400).json({ message: "Missing data" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User" });
    }

    const user = await FREELANCER.findById(userId).select(
      "status canDownloadCover createdCovers"
    );
    if (!user || user.status !== "active") {
      return res.status(400).json({ message: "Invalid User" });
    }

    if (user.canDownloadCover === true) {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
      const page = await browser.newPage();
      const tailwindCDN = `<link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">`;

      await page.setContent(
        `
        <!DOCTYPE html>
        <html>
          <head>${tailwindCDN}</head>
          <body style="margin:0; padding:0;">
            <div id="cover-wrapper" style="width:100%;">
              ${html}
            </div>
          </body>
        </html>
        `,
        { waitUntil: "networkidle0" }
      );

      // Measure actual rendered height in px
      const contentHeightPx = await page.evaluate(() => {
        const el = document.getElementById("cover-wrapper");
        return el ? el.scrollHeight : document.body.scrollHeight;
      });

      // Convert px → mm
      const contentHeightMM = contentHeightPx * 0.264583;

      // Generate PDF exactly to that size
      const pdfBuffer = await page.pdf({
        printBackground: true,
        width: "210mm", // A4 width
        height: `${contentHeightMM}mm`, // Exact content height
        pageRanges: "1", // ensure 1 page only
      });

      await browser.close();

      // Save to DB
      if (!user.createdCovers) user.createdCovers = [];
      user.createdCovers.push({
        title: `${Date.now()}-${user._id}-cover.pdf`,
        url: "",
      });
      user.canDownloadCover = false;
      await user.save();

      // Send file
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="cover_letter.pdf"',
      });

      return res.send(pdfBuffer);
    } else {
      return res
        .status(400)
        .json({ message: "Cover Letter can be downloaded after payment" });
    }
  } catch (err) {
    console.log("❌ Error downloading: ", err);
    return res.status(500).json({ message: "Error downloading : " + err });
  }
};

// create connected account
const createFreelacneStripeAccount = async (req, res) => {
  // try {
  //   const userId = req.user._id;
  //   if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
  //     return res.status(400).json({ message: "Invalid user ID" });
  //   }
  //   const user = await FREELANCER.findById(userId);
  //   if (!user || user.status == "deleted") {
  //     return res.status(401).json({ message: "User not found1" });
  //   }
  //   if (user.status == "suspended") {
  //     return res
  //       .status(400)
  //       .json({ message: "Suspended Accounts cannot be onboarded" });
  //   }
  //   if (user.onboarded === true) {
  //     return res
  //       .status(400)
  //       .json({ message: "User has completed onboarding process" });
  //   }
  //   if (user.stripeAccountId) {
  //     return res.status(200).json({ accountId: user.stripeAccountId });
  //   } else {
  //     const account = await createStripeAccount2(user.email);
  //     user.stripeAccountId = account.id;
  //     await user.save();
  //     return res.status(200).json({ accountId: account.id });
  //   }
  // } catch (err) {
  //   console.log("❌ Error creating account for user: " + err);
  //   return res
  //     .status(500)
  //     .json({ message: "Error creating stripe account", err });
  // }
};

// create onboarding session secret
const createFreelacneStripeAccountOnBoardSession = async (req, res) => {
  // try {
  //   const userId = req.user._id;
  //   if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
  //     return res.status(400).json({ message: "Invalid user ID" });
  //   }
  //   const { accountId } = req.body;
  //   if (!accountId) {
  //     return res.status(400).json({ error: "Account ID is required" });
  //   }
  //   const session = await createAccountOnbaordSession2(accountId);
  //   res.status(200).json({ clientSecret: session.client_secret });
  // } catch (err) {
  //   console.log("❌ Error creating session for user: " + err);
  //   return res
  //     .status(500)
  //     .json({ message: "Error creating stripe account session", err });
  // }
};

// check acount status
const checkFreelancerStripeAccountStatus = async (req, res) => {
  // try {
  //   const userId = req.user._id;
  //   if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
  //     return res.status(400).json({ message: "Invalid user ID" });
  //   }
  //   const { accountId } = req.query;
  //   if (!accountId) {
  //     return res.status(400).json({ error: "Account ID is required" });
  //   }
  //   const account = await retriveStripeAccount(accountId);
  //   res.status(200).json({
  //     detailsSubmitted: account.details_submitted,
  //     payoutsEnabled: account.payouts_enabled,
  //     chargesEnabled: account.charges_enabled,
  //     requirements: account.requirements,
  //   });
  // } catch (err) {
  //   console.log("❌ Error retriveing stripe account for user: " + err);
  //   return res
  //     .status(500)
  //     .json({ message: "Error retriveing stripe account", err });
  // }
};

export {
  creatFreelancerProfile,
  getFreelancerProfile,
  editFreelanceProfile,
  getUserJobStats,
  getFreelancerEarnings,
  startFreelancerOnboarding,
  checkOnboared,
  getDashboardData,
  getFreelanceProfileById,
  getFreelancerList,
  likeFreelancer,
  unlikeFreelancer,
  getFreelancerPaymentHistory,
  getMonthlyEarningsByFreelancer,
  getStripeFreelancerLogin,
  checkPaidForResume,
  downLoadResume,
  checkPaidForCoverLetter,
  downLoadCover,
  createFreelacneStripeAccount,
  createFreelacneStripeAccountOnBoardSession,
  checkFreelancerStripeAccountStatus,
};
