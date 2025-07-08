import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import User from "../database/models/users.model.js";
import mongoose from "mongoose";
import { notifyUser, NotificationTypes } from "./notification.controller.js";

// ZOD Schemas
const createJobSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  jobType: z.enum(["full-time", "part-time", "contract", "freelance"]),
  category: z.string().min(2),
  tags: z.array(z.string()).optional(),
  location: z.string().min(2, "Please provide a valid job location"),
  budget: z.number().positive(),
  plusBonus: z.boolean().optional(),
  applicationDeadline: z.string().date(),
});

const updateJobSchema = z
  .object({
    title: z.string().min(3).optional(),
    description: z.string().min(10).optional(),
    jobType: z
      .enum(["full-time", "part-time", "contract", "freelance"])
      .optional(),
    category: z.string().min(2).optional(),
    tags: z.array(z.string()).optional(),
    location: z
      .string()
      .min(2, "Please provide a valid job location")
      .optional(),
    price: z.number().positive().optional(),
    plusBonus: z.boolean().optional(),
    applicationDeadline: z.string().date().optional(),
  })
  .strict();

const createJob = async (req, res) => {
  const data = createJobSchema.parse(req.body);
  const userId = req.user?._id;

  const user = await User.findOne({
    _id: userId,
    role: { $in: ["employer"] },
    status: "active",
  });

  if (!user) {
    return res.status(403).json({
      message: "Only active employers can post jobs",
    });
  }

  // if (!user.onboarded) {
  //   return res.status(400).json({
  //     message: "Please setup payment first",
  //   });
  // }

  // Create job document
  const job = new Job({
    employerId: userId,
    ...data,
    status: "active",
  });

  await job.save();

  //   notify
  notifyUser({
    userId,
    type: NotificationTypes.JOB_APPLICATION_STATUS,
    message: `<a href="/jobs/${job._id}"> ${job.title}<a> created successfully`,
    relatedEntityId: job._id,
  });

  return res.status(201).json({
    message: "Job created successfully",
    job,
  });
};

const updateJob = async (req, res) => {
  const jobId = req.params.id;
  const employerId = req.user?._id;
  const updates = updateJobSchema.parse(req.body);

  const job = await Job.findOne({ _id: jobId, status: { $nin: ["deleted"] } });

  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  if (job.status === "expired" || job.status === "filled") {
    return res.status(400).json({
      message: `Cannot edit job because it is ${job.status}`,
    });
  }

  // Check ownership
  if (String(job.employerId) !== String(employerId)) {
    return res.status(403).json({ message: "Not authorized to edit this job" });
  }

  // Apply updates
  Object.assign(job, updates);
  await job.save();

  return res.status(200).json({
    message: "Job updated successfully",
    job,
  });
};

const jobById = async (req, res) => {
  const jobId = req.params.id;

  // Find job by ID
  const job = await Job.findOne({ _id: jobId, status: { $nin: ["deleted"] } })
    .populate("employerId", "profile.fullName, profile.profilePictureUrl")
    .populate(
      "applicants.freelancerId",
      "profile.fullName profile.profilePictureUrl"
    );

  if (!job) {
    return res.status(400).json({ message: "No Job found!" });
  }
  if (!req.user?.role?.includes("admin") && job.status !== "active") {
    return res.status(403).json({
      message: "No active job found with this ID",
    });
  }

  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  return res.status(200).json({
    message: "Job retrieved successfully",
    job,
  });
};

const getAllJobs = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    category,
    tags,
    status = "active",
    jobType,
    employerId,
  } = req.query;
  const filters = {};

  if (category) filters.category = category;
  if (jobType) filters.jobType = jobType;
  if (status && status !== "deleted") {
    filters.status = status;
  } else {
    if (!req.user?.role.includes("admin")) {
      filters.status = { $ne: "deleted" };
    }
  }

  if (tags) {
    const tagArray = Array.isArray(tags)
      ? tags
      : tags.split(",").map((t) => t.trim());
    filters.tags = { $in: tagArray };
  }

  if (employerId) {
    if (!mongoose.Types.ObjectId.isValid(employerId)) {
      return res.status(400).json({ message: "Invalid employerId" });
    }
    filters.employerId = employerId;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const total = await Job.countDocuments(filters);

  const jobs = await Job.find(filters)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(parseInt(limit))
    .select("-applicants") // exclude actual applicants
    .populate("employerId", "profile.fullName profile.profilePictureUrl")
    .lean(); // convert to plain JS objects for transformation

  if (!jobs) {
    return res.status(404).json({ message: "Jobs not found" });
  }

  const transformedJobs = jobs.map((job) => ({
    ...job,
    applicantCount: job.applicants?.length ?? 0,
  }));

  return res.status(200).json({
    total,
    page: parseInt(page),
    pages: Math.ceil(total / limit),
    results: transformedJobs.length,
    jobs: transformedJobs,
  });
};

const saveAJob = async (req, res) => {
  const userId = req.user?._id;
  const jobId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return res.status(400).json({ message: "Invalid job ID" });
  }

  // Find user with freelancer role
  const user = await User.findOne({
    _id: userId,
    status: "active",
    role: { $in: ["freelancer"] },
  });

  if (!user) {
    return res
      .status(403)
      .json({ message: "Only active freelancers can save jobs" });
  }

  // Check if job exists
  const job = await Job.findById(jobId);
  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  // Check if already saved
  const alreadySaved = user.freelancerDetails?.savedJobs?.includes(jobId);
  if (alreadySaved) {
    return res.status(400).json({ message: "Job already saved" });
  }

  // Add jobId to savedJobs
  user.freelancerDetails.savedJobs.push(jobId);
  await user.save();

  return res.status(200).json({
    message: "Job saved successfully",
    savedJobs: user.freelancerDetails.savedJobs,
  });
};

const removeSavedJob = async (req, res) => {
  const userId = req.user?._id;
  const jobId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(jobId)) {
    return res.status(400).json({ message: "Invalid job ID" });
  }

  // Find user with freelancer role
  const user = await User.findOne({
    _id: userId,
    status: "active",
    role: { $in: ["freelancer"] },
  });

  const savedJobs = user.freelancerDetails?.savedJobs || [];

  // Check if job is in savedJobs
  const index = savedJobs.findIndex((id) => id.toString() === jobId);
  if (index === -1) {
    return res.status(404).json({ message: "Job not found in saved jobs" });
  }

  // Remove the jobId from savedJobs
  savedJobs.splice(index, 1);
  user.freelancerDetails.savedJobs = savedJobs;
  await user.save();

  return res
    .status(200)
    .json({ message: "Job removed from saved jobs", savedJobs });
};

const deleteJob = async (req, res) => {
  const jobId = req.params.id;
  const userId = req.user?._id;

  const job = await Job.findOne({ _id: jobId, status: { $ne: "deleted" } });

  if (!job) {
    return res.status(404).json({ message: "Job not found" });
  }

  // Check if the logged-in user is the employer who created the job
  if (req.user?.role.includes["admin"]) {
    job.status = "deleted";
    await job.save();
    return res.status(200).json({ message: "Job deleted successfully" });
  }

  if (job.employerId.toString() !== userId.toString()) {
    return res.status(403).json({ message: "Unauthorized to delete this job" });
  }

  // Mark the job as deleted
  job.status = "deleted";
  await job.save();

  return res.status(200).json({ message: "Job deleted successfully" });
};

export {
  createJob,
  updateJob,
  jobById,
  getAllJobs,
  saveAJob,
  removeSavedJob,
  deleteJob,
};
