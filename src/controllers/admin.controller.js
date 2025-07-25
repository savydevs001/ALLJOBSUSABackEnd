import { z } from "zod";
import ADMIN from "../database/models/admin.model.js";
import { jwtToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import Job from "../database/models/jobs.model.js";

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

    const [
      allEmployers,
      allFreelancers,
      allJobseekers,
      thisMonthEmployers,
      thisMonthFreelancers,
      thisMonthJobseekers,
      allJobs,
      thisMonthJobs,
    ] = await Promise.all([
      EMPLOYER.countDocuments({}),
      FREELANCER.countDocuments({}),
      JOBSEEKER.countDocuments({}),
      EMPLOYER.countDocuments({
        createdAt: { $gte: firstOfMonth },
      }),
      FREELANCER.countDocuments({
        createdAt: { $gte: firstOfMonth },
      }),
      JOBSEEKER.countDocuments({
        createdAt: { $gte: firstOfMonth },
      }),
      Job.countDocuments({}),
      Job.countDocuments({
        createdAt: { $gte: firstOfMonth },
      }),
    ]);

    const allTimeUsers = allEmployers + allFreelancers + allJobseekers;
    const thisMonthUsers =
      thisMonthJobseekers + thisMonthEmployers + thisMonthFreelancers;

    return res.status(200).json({
      allTimeUsers,
      thisMonthUsers,
      allJobs,
      thisMonthJobs,
    });
  } catch (err) {
    console.log("❌ Error getting data: ", err);
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
