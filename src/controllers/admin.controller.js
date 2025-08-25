import { z } from "zod";
import ADMIN from "../database/models/admin.model.js";
import { jwtToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import Job from "../database/models/jobs.model.js";
import {
  createRefund,
  getTotalIncomeAndMonthlyChange,
} from "../services/stripe.service.js";
import mongoose from "mongoose";
import Application from "../database/models/applications.model.js";
import Offer from "../database/models/offers.model.js";
import Order from "../database/models/order.model.js";
import Message from "../database/models/messages.model.js";
import TRANSACTION from "../database/models/transactions.model.js";
import PENDING_PAYOUT from "../database/models/pendingPayout.model.js";
import abortSessionWithMessage from "../utils/abortSession.js";
import REFUND from "../database/models/refunds.model.js";

// create admin
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,}$/;
const createAdminZODSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      PASSWORD_REGEX,
      "Password must contain uppercase, lowercase, number, and special character"
    ),
  confirmPassword: z.string(),
});
const createAdminAccount = async (req, res) => {
  const data = createAdminZODSchema.parse(req.body);
  try {
    const admin = await ADMIN.find();

    if (admin.length > 1) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const { salt, hash } = hashPassword(data.password);
    const newAdmin = new ADMIN({
      email: data.email,
      password: {
        hash: hash,
        salt: salt,
      },
    });
    await newAdmin.save();

    const token = jwtToken(newAdmin, "admin", true);
    if (token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }

    return res.status(201).json({
      message: "Signup successful",
      token,
    });
  } catch (err) {
    console.log("❌ Error creating admin account: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// login admin
const loginAdminZODSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string("Password is required"),
});
const loginAdminAccount = async (req, res) => {
  const data = loginAdminZODSchema.parse(req.body);
  try {
    const admin = await ADMIN.findOne({ email: data.email });

    if (!admin) {
      return res.status(404).json({ message: "Invalid credentials" });
    }

    const isMatch = verifyPassword(
      data.password,
      admin.password.salt,
      admin.password.hash
    );
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwtToken(admin, "admin", true);
    if (token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }

    if (admin.passwordChanged === true) {
      admin.passwordChanged = false;
      await admin.save();
    }

    return res.status(201).json({
      message: "Signin successful",
      token,
    });
  } catch (err) {
    console.log("❌ Error logging in admin account: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// dashboard data
const adminDashboardData = async (req, res) => {
  try {
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const firstOfPreviousMonth = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1
    );
    const lastOfPreviousMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Helper to extract counts from aggregation result
    const extractCount = (facetArray) => facetArray[0]?.count || 0;

    const [
      subscriptionEarning,
      employerAgg,
      freelancerAgg,
      jobseekerAgg,
      jobAgg,
    ] = await Promise.all([
      getTotalIncomeAndMonthlyChange(),
      EMPLOYER.aggregate([
        {
          $facet: {
            allTime: [{ $count: "count" }],
            thisMonth: [
              { $match: { createdAt: { $gte: firstOfMonth } } },
              { $count: "count" },
            ],
            previousMonth: [
              {
                $match: {
                  createdAt: {
                    $gte: firstOfPreviousMonth,
                    $lte: lastOfPreviousMonth,
                  },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]),
      FREELANCER.aggregate([
        {
          $facet: {
            allTime: [{ $count: "count" }],
            thisMonth: [
              { $match: { createdAt: { $gte: firstOfMonth } } },
              { $count: "count" },
            ],
            previousMonth: [
              {
                $match: {
                  createdAt: {
                    $gte: firstOfPreviousMonth,
                    $lte: lastOfPreviousMonth,
                  },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]),
      JOBSEEKER.aggregate([
        {
          $facet: {
            allTime: [{ $count: "count" }],
            thisMonth: [
              { $match: { createdAt: { $gte: firstOfMonth } } },
              { $count: "count" },
            ],
            previousMonth: [
              {
                $match: {
                  createdAt: {
                    $gte: firstOfPreviousMonth,
                    $lte: lastOfPreviousMonth,
                  },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]),
      Job.aggregate([
        {
          $facet: {
            allTime: [{ $count: "count" }],
            thisMonth: [
              { $match: { createdAt: { $gte: firstOfMonth } } },
              { $count: "count" },
            ],
            previousMonth: [
              {
                $match: {
                  createdAt: {
                    $gte: firstOfPreviousMonth,
                    $lte: lastOfPreviousMonth,
                  },
                },
              },
              { $count: "count" },
            ],
          },
        },
      ]),
    ]);

    // Extract counts
    const allEmployers = extractCount(employerAgg[0].allTime);
    const thisMonthEmployers = extractCount(employerAgg[0].thisMonth);
    const previousMonthEmployers = extractCount(employerAgg[0].previousMonth);

    const allFreelancers = extractCount(freelancerAgg[0].allTime);
    const thisMonthFreelancers = extractCount(freelancerAgg[0].thisMonth);
    const previousMonthFreelancers = extractCount(
      freelancerAgg[0].previousMonth
    );

    const allJobseekers = extractCount(jobseekerAgg[0].allTime);
    const thisMonthJobseekers = extractCount(jobseekerAgg[0].thisMonth);
    const previousMonthJobseekers = extractCount(jobseekerAgg[0].previousMonth);

    const allJobs = extractCount(jobAgg[0].allTime);
    const thisMonthJobs = extractCount(jobAgg[0].thisMonth);
    const previousMonthJobs = extractCount(jobAgg[0].previousMonth);

    // Combine counts
    const allTimeUsers = allEmployers + allFreelancers + allJobseekers;
    const thisMonthUsers =
      thisMonthEmployers + thisMonthFreelancers + thisMonthJobseekers;
    const previousMonthUsers =
      previousMonthEmployers +
      previousMonthFreelancers +
      previousMonthJobseekers;

    const usersPercentChange =
      previousMonthUsers === 0
        ? thisMonthUsers === 0
          ? 0
          : 100 // handle division by 0
        : ((thisMonthUsers - previousMonthUsers) / previousMonthUsers) * 100;

    const freelancersPercentageChange =
      previousMonthFreelancers === 0
        ? thisMonthFreelancers === 0
          ? 0
          : 100
        : ((thisMonthFreelancers - previousMonthFreelancers) /
            previousMonthFreelancers) *
          100;

    const jobsPercentChange =
      previousMonthJobs === 0
        ? thisMonthJobs === 0
          ? 0
          : 100
        : ((thisMonthJobs - previousMonthJobs) / previousMonthJobs) * 100;

    return res.status(200).json({
      subscriptionEarning,
      allTimeUsers,
      usersPercentChange: Math.round(usersPercentChange).toFixed(2),
      allTimeFreelancers: allFreelancers,
      freelancersPercentageChange: freelancersPercentageChange.toFixed(2),
      allJobs,
      jobsPercentChange: Math.round(jobsPercentChange).toFixed(2),
    });
  } catch (err) {
    console.error("❌ Error getting admin dashboard data:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getMonthlyJobStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1); // Jan 1st of current year

    const monthlyJobs = await Job.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfYear },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          jobCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          month: "$_id.month",
          year: "$_id.year",
          jobCount: 1,
        },
      },
      { $sort: { year: 1, month: 1 } },
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

    // Fill all months, including those with 0 jobs
    const result = Array.from({ length: 12 }, (_, i) => {
      const entry = monthlyJobs.find((e) => e.month === i + 1);
      return {
        month: monthNames[i],
        jobCount: entry ? entry.jobCount : 0,
      };
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error("❌ Error getting monthly job stats:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// active users stats
const getTotalUserStats = async (req, res) => {
  try {
    const [employerStats, freelancerStats, jobseekerStats] = await Promise.all([
      EMPLOYER.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            active: [{ $match: { status: "active" } }, { $count: "count" }],
            suspended: [
              { $match: { status: "suspended" } },
              { $count: "count" },
            ],
            deleted: [{ $match: { status: "deleted" } }, { $count: "count" }],
          },
        },
      ]),
      FREELANCER.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            active: [{ $match: { status: "active" } }, { $count: "count" }],
            suspended: [
              { $match: { status: "suspended" } },
              { $count: "count" },
            ],
            deleted: [{ $match: { status: "deleted" } }, { $count: "count" }],
          },
        },
      ]),
      JOBSEEKER.aggregate([
        {
          $facet: {
            total: [{ $count: "count" }],
            active: [{ $match: { status: "active" } }, { $count: "count" }],
            suspended: [
              { $match: { status: "suspended" } },
              { $count: "count" },
            ],
            deleted: [{ $match: { status: "deleted" } }, { $count: "count" }],
          },
        },
      ]),
    ]);

    // Helper
    const extract = (result, key) => result[0][key]?.[0]?.count || 0;

    const totalUsers =
      extract(employerStats, "total") +
      extract(freelancerStats, "total") +
      extract(jobseekerStats, "total");

    const activeUsers =
      extract(employerStats, "active") +
      extract(freelancerStats, "active") +
      extract(jobseekerStats, "active");

    const suspendedUsers =
      extract(employerStats, "suspended") +
      extract(freelancerStats, "suspended") +
      extract(jobseekerStats, "suspended");

    const deletedUsers =
      extract(employerStats, "deleted") +
      extract(freelancerStats, "deleted") +
      extract(jobseekerStats, "deleted");

    return res.status(200).json({
      totalUsers,
      activeUsers,
      suspendedUsers,
      deletedUsers,
    });
  } catch (err) {
    console.error("❌ Error getting user stats:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get users
const getUsers = async (req, res) => {
  try {
    const { status, text, role = "employer", skip = 0, limit = 10 } = req.query;

    // Validate role
    if (!["employer", "freelancer", "job-seeker"].includes(role)) {
      return res.status(400).json({
        message:
          "Invalid role provided. Either employer, freelancer, job-seeker",
      });
    }

    // Pick the appropriate model
    let Model;
    if (role === "employer") Model = EMPLOYER;
    else if (role === "freelancer") Model = FREELANCER;
    else Model = JOBSEEKER;

    // Build query
    const query = {};
    if (status && status != "") query.status = status;
    if (text && text != "") {
      if (mongoose.Types.ObjectId.isValid(text)) {
        query._id = new mongoose.Types.ObjectId(text);
      } else {
        query.$or = [
          { fullName: { $regex: text, $options: "i" } },
          { email: { $regex: text, $options: "i" } },
        ];
      }
    }

    const [users, total] = await Promise.all([
      Model.find(query)
        .select("_id fullName createdAt email status")
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      Model.countDocuments(query),
    ]);

    return res.status(200).json({
      users,
      total,
      skip: Number(skip),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("❌ Error getting users for admin:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// job stats
const getJobsStats = async (req, res) => {
  try {
    const [jobStats] = await Job.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          emptyStatus: [{ $match: { status: "empty" } }, { $count: "count" }],
          featured: [{ $match: { isFeatured: true } }, { $count: "count" }],
        },
      },
    ]);

    const formatCount = (arr) => arr[0]?.count || 0;

    return res.status(200).json({
      totalJobs: formatCount(jobStats.total),
      activeJobs: formatCount(jobStats.emptyStatus),
      featuredJobs: formatCount(jobStats.featured),
    });
  } catch (err) {
    console.error("❌ Error getting job stats:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get jobs
const getJobs = async (req, res) => {
  try {
    const { status, text, skip = 0, limit = 10 } = req.query;

    // Build base match query
    const matchStage = {};
    if (status && status !== "") {
      matchStage.status = status;
    }

    // Initial pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "employers", // collection name (lowercase plural)
          localField: "employerId",
          foreignField: "_id",
          as: "employer",
        },
      },
      { $unwind: "$employer" },
    ];

    // Text filter
    if (text && text.trim() !== "") {
      const isValidObjectId = mongoose.Types.ObjectId.isValid(text);
      const textMatch = {
        $or: [
          ...(isValidObjectId
            ? [{ _id: new mongoose.Types.ObjectId(text) }]
            : []),
          { "employer.fullName": { $regex: text, $options: "i" } },
          { "employer.email": { $regex: text, $options: "i" } },
        ],
      };
      pipeline.push({ $match: textMatch });
    }

    // Count pipeline for total documents
    const countPipeline = [...pipeline, { $count: "total" }];

    // Project only required fields
    pipeline.push(
      {
        $project: {
          _id: 1,
          title: 1,
          status: 1,
          createdAt: 1,
          isFeatured: 1,
          locationCity: "$simpleJobDetails.locationCity",
          locationState: "$simpleJobDetails.locationState",
          employer: {
            _id: "$employer._id",
            fullName: "$employer.fullName",
            email: "$employer.email",
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $skip: Number(skip) },
      { $limit: Number(limit) }
    );

    // Execute both count and data queries
    const [results, totalResult] = await Promise.all([
      Job.aggregate(pipeline),
      Job.aggregate(countPipeline),
    ]);

    const transformData = results.map((e) => ({
      _id: e._id,
      title: e.title,
      status: e.status,
      createdAt: e.createdAt,
      employer: e.employer,
      isFeatured: e.isFeatured === true ? true : false,
      location:
        e.locationCity && e.locationState
          ? e.locationCity + ", " + e.locationState
          : "Remote",
    }));

    return res.status(200).json({
      jobs: transformData,
      total: totalResult[0]?.total || 0,
      skip: Number(skip),
      limit: Number(limit),
    });
  } catch (err) {
    console.error("❌ Error getting jobs for admin:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getTrendingJobs = async (req, res) => {
  try {
    const { skip = 0, limit = 10, text, status } = req.query;

    const DAYS = 30;
    const APPLICATION_THRESHOLD = 0;
    const OFFER_THRESHOLD = 0;

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - DAYS);

    // Run aggregations in parallel
    const [applicationAgg, offerAgg] = await Promise.all([
      Application.aggregate([
        { $match: { createdAt: { $gte: fromDate }, status: "pending" } },
        {
          $group: {
            _id: "$jobId",
            count: { $sum: 1 },
            earliest: { $min: "$createdAt" },
          },
        },
        { $match: { count: { $gte: APPLICATION_THRESHOLD } } },
      ]),
      Offer.aggregate([
        {
          $match: {
            createdAt: { $gte: fromDate },
            jobId: { $ne: null },
            status: "pending",
          },
        },
        {
          $group: {
            _id: "$jobId",
            count: { $sum: 1 },
            earliest: { $min: "$createdAt" },
          },
        },
        { $match: { count: { $gte: OFFER_THRESHOLD } } },
      ]),
    ]);

    // Merge job IDs and determine earliest trending date
    const jobTrendingMap = new Map();
    for (const entry of [...applicationAgg, ...offerAgg]) {
      const jobId = entry._id.toString();
      const existingDate = jobTrendingMap.get(jobId);
      if (!existingDate || entry.earliest < existingDate) {
        jobTrendingMap.set(jobId, entry.earliest);
      }
    }

    const uniqueJobIds = Array.from(jobTrendingMap.keys());

    // Build dynamic filters
    const jobFilter = {
      _id: { $in: uniqueJobIds },
    };

    if (text) {
      jobFilter.title = { $regex: text, $options: "i" };
    }

    if (status) {
      jobFilter.status = status;
    }

    // Query trending jobs
    const trendingJobs = await Job.find(jobFilter)
      .select(
        "_id title createdAt isFeatured status simpleJobDetails.locationCity simpleJobDetails.locationState employerId"
      )
      .populate("employerId", "_id fullName email")
      .skip(Number(skip))
      .limit(Number(limit));

    const now = new Date();

    const transformData = trendingJobs.map((e) => {
      const jobId = e._id.toString();
      const trendingSince = new Date(jobTrendingMap.get(jobId));
      const diffTime = Math.abs(now - trendingSince);
      const trendingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return {
        _id: e._id,
        title: e.title,
        status: e.status,
        createdAt: e.createdAt,
        trendingDays,
        employer: {
          _id: e.employerId._id,
          fullName: e.employerId.fullName,
          email: e.employerId.email,
        },
        isFeatured: e.isFeatured === true,
        location:
          e.simpleJobDetails?.locationCity && e.simpleJobDetails?.locationState
            ? e.simpleJobDetails.locationCity +
              ", " +
              e.simpleJobDetails.locationState
            : "Remote",
      };
    });

    return res.status(200).json({
      jobs: transformData,
      total: uniqueJobIds.length,
      skip: Number(skip),
      limit: Number(limit),
    });
  } catch (error) {
    console.error("Error getting trending jobs:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// freelancer stats
const getFreelancerStats = async (req, res) => {
  try {
    const freelancerStats = await FREELANCER.aggregate([
      {
        $facet: {
          total: [{ $count: "count" }],
          active: [{ $match: { status: "active" } }, { $count: "count" }],
          suspended: [{ $match: { status: "suspended" } }, { $count: "count" }],
          deleted: [{ $match: { status: "deleted" } }, { $count: "count" }],
        },
      },
    ]);

    const extract = (result, key) => result[0][key]?.[0]?.count || 0;
    const totalFreelancers = extract(freelancerStats, "total");
    const activeFreelancers = extract(freelancerStats, "active");
    const suspendedFreelancers = extract(freelancerStats, "suspended");
    const deletedFreelancers = extract(freelancerStats, "deleted");

    return res.status(200).json({
      totalFreelancers,
      activeFreelancers,
      suspendedFreelancers,
      deletedFreelancers,
    });
  } catch (err) {
    console.log("❌ Error getting freelancer stats");
    return res.status(200).json({ message: "Server Error" });
  }
};

// freelancers
const getFreelancers = async (req, res) => {
  try {
    const { text, status, skip = 0, limit = 10 } = req.query;

    const filter = {};
    if (status && status != "") {
      filter.status = status;
    }
    if (text && text != "") {
      if (mongoose.Types.ObjectId.isValid(text)) {
        filter._id = new mongoose.Types.ObjectId(text);
      } else {
        filter.$or = [
          { fullName: { $regex: text, $options: "i" } },
          { email: { $regex: text, $options: "i" } },
        ];
      }
    }

    const [users, total] = await Promise.all([
      FREELANCER.find(filter)
        .select(
          "_id fullName email profilePictureUrl rating status profile.badge"
        )
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      FREELANCER.countDocuments(filter),
    ]);

    const transformed = users.map((e) => ({
      _id: e._id,
      fullName: e.fullName,
      email: e.email,
      profilePictureUrl: e.profilePictureUrl,
      status: e.status,
      badge: e.profile.badge,
      rating: e.rating,
    }));

    return res.status(200).json({
      users: transformed,
      total,
      skip: Number(skip),
      limit: Number(limit),
    });
  } catch (err) {
    console.log("❌ Error getting freelancer profiles");
    return res.status(500).json({ message: "Server Error" });
  }
};

// change Freelancer Badge
const changeFreelancerBadge = async (req, res) => {
  try {
    const reqBody = req.body;
    if (!reqBody) {
      return res.status(400).json({ message: "Invlaid request data" });
    }
    const { freelancerId, newBadge } = reqBody;

    if (!freelancerId || !mongoose.Types.ObjectId.isValid(freelancerId)) {
      return res.status(400).json({ message: "Invalid freelancer" });
    }
    if (
      !newBadge ||
      ![
        "New",
        "Level-1",
        "Level-2",
        "Top-rated",
        "New-talent",
        "Fast-response",
        "Pro",
      ].includes(newBadge)
    ) {
      return res.status(400).json({ message: "Invalid newBadge" });
    }

    const freelancer = await FREELANCER.findByIdAndUpdate(freelancerId, {
      "profile.badge": newBadge,
    });

    if (!freelancer) {
      return res.status(400).json({ message: "Freelancer not found" });
    }
    return res.status(200).json({ message: "Badge Updated" });
  } catch (err) {
    console.log("❌ Error changing freelancer newBadge: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// order stats
const orderStats = async (req, res) => {
  try {
    const orders = await Order.find({}).select({ status: 1 });

    let disputed = 0;
    let inProgress = 0;
    let completed = 0;
    let cancelled = 0;
    let payment_pending = 0;
    orders.forEach((o) => {
      switch (o.status) {
        case "in_progress":
        case "in_revision":
        case "delivered":
          inProgress += 1;
          break;
        case "completed":
          completed += 1;
          break;
        case "disputed":
          disputed += 1;
          break;
        case "cancelled":
          cancelled += 1;
          break;
        case "payment_pending":
          payment_pending += 1;
          break;
        default:
          break;
      }
    });

    return res.status(200).json({
      total: orders.length - payment_pending,
      inProgress,
      completed,
      disputed,
      cancelled,
    });
  } catch (err) {
    console.log("❌ Error getting order stats: ", err);
    return res.status(500).json({ message: "Errror getting order stats", err });
  }
};

// order list
const getOrdersWithPartiesData = async (req, res) => {
  try {
    const { text, status, skip = 0, limit = 10 } = req.query;
    const filter = {
      status: { $ne: "payment_pending" },
    };
    if (status && status != "") {
      filter.status = { $eq: status, $ne: "payment_pending" };
    }

    if (text && text != "") {
      if (mongoose.Types.ObjectId.isValid(text)) {
        filter._id = new mongoose.Types.ObjectId(text);
      } else {
        filter.$or = [
          { title: { $regex: text, $options: "i" } },
          { description: { $regex: text, $options: "i" } },
        ];
      }
    }

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .select(
          "_id title description status createdAt totalAmount employerModel disputeDetails.notes"
        )
        .populate({
          path: "freelancerId",
          select: "email fullName profilePictureUrl",
          model: "freelancer",
        })
        .populate({
          path: "employerId",
          select: "email fullName profilePictureUrl",
          // model will be resolved automatically from employerModel (refPath)
        })
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      Order.countDocuments(filter),
    ]);

    const tranformed = orders.map((e) => ({
      _id: e._id,
      title: e.title,
      description: e.description,
      status: e.status,
      createdAt: e.createdAt,
      totalAmount: e.totalAmount,
      internalNote: e.disputeDetails?.notes || "",
      freelancer: {
        _id: e.freelancerId?._id,
        fullName: e.freelancerId?.fullName,
        email: e.freelancerId?.email,
        profilePictureUrl: e.freelancerId?.profilePictureUrl,
      },
      employer: {
        _id: e.employerId?._id,
        fullName: e.employerId?.fullName,
        email: e.employerId?.email,
        profilePictureUrl: e.employerId?.profilePictureUrl,
        role: e.employerModel,
      },
    }));

    return res.status(200).json({ orders: tranformed, total });
  } catch (err) {
    console.log("❌ Error getting orders data: ", err);
    return res
      .status(500)
      .json({ message: "Error getting orders data: ", err });
  }
};

// mark order as disputed
const markOrderAsDisputed = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { details } = req.body;
    if (!details) {
      return res.status(400).json({ message: "Details field required" });
    }
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "No Order found" });
    }
    if (order.status == "disputed") {
      return res
        .status(400)
        .json({ message: "Order already marked as disputed" });
    }
    if (order.status == "payment_pending") {
      return res.status(400).json({
        message: "Order cannot be marked as disputed as it has payment pending",
      });
    }

    if (
      order.status == "in_revision" ||
      order.status == "in_progress" ||
      order.status == "delivered"
    ) {
      order.status = "disputed";
      order.disputeDetails = {
        reason: details,
      };
      await order.save();
      return res.status(200).json({ message: "Order marked as disputed" });
    } else {
      return res
        .status(400)
        .json({ message: "This order cannot be marked as disputed" });
    }
  } catch (err) {
    console.log("❌ Error marking order as disputed: ", err);
    return res
      .status(500)
      .json({ message: "Unable to mark order as disputed", err });
  }
};

// get Messages with user ids
const getMessagesByUsers = async (req, res) => {
  try {
    const userId = req.query?.userid;
    const withUserId = req.query?.withuserid;

    if (
      !userId ||
      !withUserId ||
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(withUserId)
    ) {
      return res.status(400).json({ message: "Invalid sender or receiver Id" });
    }

    const { limit = 50, skip = 0 } = req.query;

    const filters = {
      $or: [
        { senderId: userId, receiverId: withUserId },
        { senderId: withUserId, receiverId: userId },
      ],
    };

    const messages = await Message.find(filters)
      .sort({ sentAt: -1 }) // ascending
      .skip(skip)
      .limit(limit)
      .lean();

    if ((!messages || messages.length == 0) && skip == 0) {
      return res.status(200).json({
        message: "No message exists",
        data: [],
      });
    }

    messages.reverse();

    return res.status(200).json({
      data: messages,
    });
  } catch (error) {
    console.error("❌ Failed to fetch messages:", error);
    return res.status(500).json({ message: "Server Error" });
  }
};

// add note to order
const addNoteToOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { note } = req.body;
    if (!note) {
      return res.status(400).json({ message: "Note field required" });
    }
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ message: "Invalid order id" });
    }

    const order = await Order.findById(orderId).select("disputeDetails");
    if (!order) {
      return res.status(404).json({ message: "No Order found" });
    }

    if (!order.disputeDetails) {
      order.disputeDetails = {
        notes: note,
      };
      await order.save();
    } else if (order.disputeDetails?.notes != note) {
      order.disputeDetails.notes = note;
      await order.save();
    }

    return res.status(200).json({ message: "Note added to order" });
  } catch (err) {
    console.log("❌ Error adding note: ", err);
    return res.status(500).json({ message: "Error adding note", err });
  }
};

// complete disputed order
const completeDisputedOrder = async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const orderId = req.params.id;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return abortSessionWithMessage(res, mongooseSession, "Invalid order ID");
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "Order not found",
        404
      );
    }

    if (order.status != "disputed") {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "This order is not a disputed order"
      );
    }

    //  validate transaction
    const transaction = await TRANSACTION.findById(order.transactionId);
    if (!transaction || !transaction.orderDeatils) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "Transaction not found",
        404
      );
    }

    if (transaction.orderDeatils.status != "escrow_held") {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "No Payment Held for this order"
      );
    }

    // validate freelancer
    const freelancer = await FREELANCER.findById(order.freelancerId);
    if (!freelancer || !freelancer.stripeAccountId) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "Freelancer or Stripe account not found",
        404
      );
    }

    // Create a pending payout record (delay 7 days)
    const releaseDate = new Date();
    releaseDate.setDate(releaseDate.getDate() + 7);

    const pendingPayout = new PENDING_PAYOUT({
      freelancerId: freelancer._id,
      stripeAccountId: freelancer.stripeAccountId,
      amount: transaction.orderDeatils.amountToBePaid,
      transferGroup: `order_${order._id}`,
      releaseDate,
      orderId: order._id,
      transactionId: transaction._id,
    });

    // update paymet of freelancer
    freelancer.pendingClearence =
      freelancer.pendingClearence + transaction.orderDeatils.amountToBePaid;
    freelancer.projectsCompleted = freelancer.projectsCompleted + 1;
    await freelancer.save({ session: mongooseSession });

    // mark order as completed
    order.status = "completed";
    order.disputeDetails.resolutionStatus = "resolved_in_favor_freelancer";
    order.completionDate = new Date();

    // update employer if employer
    const employer = await EMPLOYER.findById(order.employerId);
    if (employer) {
      employer.ordersCompleted = employer.ordersCompleted + 1;
      await employer.save({ session: mongooseSession });
    }

    await pendingPayout.save({ session: mongooseSession });
    await order.save({ session: mongooseSession });

    await mongooseSession.commitTransaction();
    mongooseSession.endSession();

    return res.status(200).json({
      message: "Order marked as complete. Payout scheduled after 7 days.",
      success: true,
    });
  } catch (err) {
    console.log("❌ Error completing a disputed order: ", err);
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    return res
      .status(500)
      .json({ message: "Error completing a disputed order", err });
  }
};

// cancel disputed order
const cancelDisputedOrder = async (req, res) => {
  const mongooseSession = await mongoose.startSession();
  mongooseSession.startTransaction();
  try {
    const orderId = req.params.id;
    if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
      return abortSessionWithMessage(res, mongooseSession, "Invalid order ID");
    }

    const order = await Order.findById(orderId).populate(
      "employerId",
      "_id fullName email"
    );
    if (!order) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "Order not found",
        404
      );
    }

    if (order.status != "disputed") {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "This order is not a disputed order"
      );
    }

    //  validate transaction
    const transaction = await TRANSACTION.findById(order.transactionId);
    if (!transaction || !transaction.orderDeatils) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "Transaction not found",
        404
      );
    }

    if (transaction.orderDeatils.status != "escrow_held") {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "No Payment Held for this order"
      );
    }

    if (!transaction.orderDeatils.stripeIntentId) {
      return abortSessionWithMessage(
        res,
        mongooseSession,
        "No Payment intent attached with order"
      );
    }

    // create stripe refund
    // const refund = await createRefund(transaction.orderDeatils.stripeIntentId);

    // create refund
    const refund = new REFUND({
      orderId: order.id,
      receiverId: order.employerId,
      receiverModel: order.employerModel,
      receiverName: order.employerId?.fullName,
      receiverEmail: order.employerId?.email,
      transactionId: transaction._id,
    });

    // mark order as cancelled
    order.status = "cancelled";
    order.disputeDetails.resolutionStatus = "resolved_in_favor_employer";
    order.disputeDetails.refundId = refund.id;
    order.cancelledDate = new Date();

    // update employer if employer
    const employer = await EMPLOYER.findById(order.employerId);
    if (employer) {
      employer.ordersCancelled = employer.ordersCancelled + 1;
      await employer.save({ session: mongooseSession });
    }

    await order.save({ session: mongooseSession });
    await refund.save({ session: mongooseSession });

    await mongooseSession.commitTransaction();
    mongooseSession.endSession();

    return res.status(200).json({
      message: "Order marked as cancelled. Refund is created.",
      success: true,
    });
  } catch (err) {
    console.log("❌ Error completing a disputed order: ", err);
    await mongooseSession.abortTransaction();
    mongooseSession.endSession();
    return res
      .status(500)
      .json({ message: "Error completing a disputed order", err });
  }
};

// get refunds
const getRefunds = async (req, res) => {
  try {
    const { text, status, skip = 0, limit = 10 } = req.query;

    const filter = {};
    if (status && status != "") {
      filter.status = status;
    }
    if (text && text != "") {
      if (mongoose.Types.ObjectId.isValid(text)) {
        filter.orderId = new mongoose.Types.ObjectId(text);
      } else {
        filter.$or = [
          { receiverName: { $regex: text, $options: "i" } },
          { receiverEmail: { $regex: text, $options: "i" } },
        ];
      }
    }

    const [refunds, total] = await Promise.all([
      REFUND.find(filter)
        .select("_id orderId receiverName receiverEmail status requestedDate")
        .populate("orderId", "disputeDetails.reason totalAmount")
        .sort({ createdAt: -1 })
        .skip(Number(skip))
        .limit(Number(limit)),
      REFUND.countDocuments(filter),
    ]);

    const transformed = refunds.map((e) => ({
      _id: e._id,
      orderId: e.orderId._id,
      receiverName: e.receiverName,
      receiverEmail: e.receiverEmail,
      status: e.status,
      requestedDate: e.requestedDate,
      reason: e.orderId.disputeDetails.reason,
      totalAmount: e.orderId.totalAmount,
    }));

    return res.status(200).json({
      refunds: transformed,
      total,
      skip: Number(skip),
      limit: Number(limit),
    });
  } catch (err) {
    console.log("❌ Error getting  refunds details: ", err);
    return res
      .status(500)
      .json({ message: "error getting refunds details", err });
  }
};

// reject refund
const rejectRefunds = async (req, res) => {
  try {
    const refundId = req.params?.id;
    if (!refundId || !mongoose.Types.ObjectId.isValid(refundId)) {
      return res.status(400).json({ message: "Invalid refund id" });
    }

    const refund = await REFUND.findById(refundId);
    if (!refund) {
      return res.status(404).json({ message: "Not found" });
    }

    if (refund.status == "rejected") {
      return res
        .status(400)
        .json({ message: "This refund is already rejected" });
    }

    if (refund.status != "pending") {
      return res
        .status(400)
        .json({ message: "Only pending refunds can be rejected" });
    }

    refund.status = "rejected";
    refund.completionOrCancelDate = new Date();
    await refund.save();

    return res.status(200).json({
      message: "Refund rejected successfully",
    });
  } catch (err) {
    console.log("❌ Error rejecting refund: ", err);
    return res.status(500).json({ message: "Error rejecting refund", err });
  }
};

// approve refund
const approveRefunds = async (req, res) => {
  try {
    const refundId = req.params?.id;
    if (!refundId || !mongoose.Types.ObjectId.isValid(refundId)) {
      return res.status(400).json({ message: "Invalid refund id" });
    }

    const refund = await REFUND.findById(refundId).populate(
      "transactionId",
      "orderDeatils.stripeIntentId"
    );
    if (!refund) {
      return res.status(404).json({ message: "Not found" });
    }

    if (refund.status == "approved") {
      return res
        .status(400)
        .json({ message: "This refund is already approved" });
    }

    if (refund.status != "pending") {
      return res
        .status(400)
        .json({ message: "Only pending refunds can be approved" });
    }

    // console.log("Refund: ", refund);

    if (!refund.transactionId) {
      return res.status(404).json({ message: "Order transaction not found" });
    }

    if (!refund.transactionId?.orderDeatils?.stripeIntentId) {
      return res
        .status(400)
        .json({ message: "No intent for payment found in order transaction" });
    }

    // create a refund
    const stripeRefund = await createRefund(
      refund.transactionId?.orderDeatils?.stripeIntentId
    );

    refund.status = "approved";
    refund.completionOrCancelDate = new Date();
    refund.stripeRefundId = stripeRefund.id;

    await refund.save();

    return res.status(200).json({
      message: "Refund approved successfully",
    });
  } catch (err) {
    console.log("❌ Error approving refund: ", err);
    return res.status(500).json({ message: "Error approving refund", err });
  }
};

// suspend User
const suspendUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const userRole = req.query?.role;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    let user;
    switch (userRole) {
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    if (user.status === "active") {
      user.status = "suspended";
      await user.save();
      return res
        .status(200)
        .json({ message: "Account suspended successfully" });
    }

    return res
      .status(400)
      .json({ message: "Only Active account can be suspended" });
  } catch (err) {
    console.log("Error Suspending a user: ", err);
    return res
      .status(500)
      .json({ message: "Error suspending user", err: err.message });
  }
};

// delete user
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const userRole = req.query?.role;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    if (!userRole) {
      return res.status(400).json({ message: "No role in query parameters" });
    }

    let user;
    switch (userRole) {
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    if (user.status == "deleted") {
      return res.status(400).json({ message: "User account already deleted" });
    }

    if (user.status === "active" || user.status === "suspended") {
      user.status = "deleted";
      user.isDeletedByAdmin = true;
      await user.save();
      return res.status(200).json({ message: "Account deleted successfully" });
    }

    return res
      .status(400)
      .json({ message: "Only Active/suspended account can be deleted" });
  } catch (err) {
    console.log("Error Suspending a user: ", err);
    return res
      .status(500)
      .json({ message: "Error suspending user", err: err.message });
  }
};

// unsuspend user
const unSuspendUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const userRole = req.query?.role;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid User Id" });
    }

    let user;
    switch (userRole) {
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      case "employer":
        user = await EMPLOYER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found!" });
    }

    if (user.status === "suspended") {
      user.status = "active";
      await user.save();
      return res.status(200).json({ message: "Account Reactivated" });
    }

    return res
      .status(400)
      .json({ message: "Only Suspended account can be Activated" });
  } catch (err) {
    console.log("Error Reactivating a user: ", err);
    return res
      .status(500)
      .json({ message: "Error Reactivating user", err: err.message });
  }
};

export {
  createAdminAccount,
  loginAdminAccount,
  adminDashboardData,
  getMonthlyJobStats,
  getTotalUserStats,
  getUsers,
  getJobsStats,
  getJobs,
  getTrendingJobs,
  getFreelancerStats,
  getFreelancers,
  changeFreelancerBadge,
  orderStats,
  getOrdersWithPartiesData,
  markOrderAsDisputed,
  getMessagesByUsers,
  addNoteToOrder,
  completeDisputedOrder,
  cancelDisputedOrder,
  getRefunds,
  rejectRefunds,
  approveRefunds,
  suspendUser,
  deleteUser,
  unSuspendUser,
};
