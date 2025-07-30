import { z } from "zod";
import ADMIN from "../database/models/admin.model.js";
import { jwtToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import Job from "../database/models/jobs.model.js";
import { getTotalIncomeAndMonthlyChange } from "../services/stripe.service.js";

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
    const admin = await ADMIN.findOne({ email: data.email });

    if (admin) {
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
      usersPercentChange: Math.round(usersPercentChange),
      allTimeFreelancers: allFreelancers,
      freelancersPercentageChange,
      allJobs,
      jobsPercentChange: Math.round(jobsPercentChange),
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

export {
  createAdminAccount,
  loginAdminAccount,
  adminDashboardData,
  getMonthlyJobStats,
};
