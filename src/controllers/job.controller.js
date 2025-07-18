import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import User from "../database/models/users.model.js";
import mongoose, { mongo } from "mongoose";
import { notifyUser, NotificationTypes } from "./notification.controller.js";
import FREELANCER from "../database/models/freelancer.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import getDateNDaysFromNow from "../utils/date-and-days.js";
import calculateJobMatchPercentage from "../utils/calculate-job-match.js";

// POST job
const createJobZODSchema = z.object({
  title: z
    .string()
    .min(5, "Job title must be at least 5 characters")
    .max(100, "Job title can't exceed 100 characters"),
  description: z
    .string()
    .min(20, "Description must be at least 20 characters")
    .max(5000, "Description can't exceed 5000 characters"),
  job: z.enum(["simple", "freelance"], {
    errorMap: () => ({ message: "Invalid job" }),
  }),
});
const simpleJobZODSchema = z.object({
  jobType: z.enum(
    ["Full-time", "Part-time", "Contract", "Internship", "Freelance"],
    {
      errorMap: () => ({ message: "Invalid job type" }),
    }
  ),
  category: z.string().min(2, "Category is required"),
  minSalary: z.number().min(0, "Minimum salary must be at least 0"),
  maxSalary: z.number().min(5, "Maximum salary must be at least 0"),
  locationCity: z.string().min(2, "City is required"),
  locationState: z.string().min(2, "State is required"),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Expert"]),
  deadline: z.coerce.date({
    errorMap: () => ({ message: "Invalid date format" }),
  }),
});
const freelanceZODSchema = z.object({
  requiredSkills: z
    .array(z.string().min(1, "Skill should be of min 1 chracter long"))
    .min(1, "At least one skill is required"),
  budget: z.object({
    budgetType: z.enum(["Fixed", "Start"]),
    price: z.number().optional(),
    minimum: z.number().optional(),
    maximum: z.number().optional(),
  }),
  durationDays: z
    .number()
    .positive()
    .min(1, "At least one day is required to project commpletion"),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Expert"]),
  files: z.array(z.object({ name: z.string(), url: z.string() })).optional(),
});
const createJob = async (req, res) => {
  let data = createJobZODSchema.parse(req.body);
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Invalid user" });
    }

    // validation for job = simple
    if (data.job === "simple") {
      const temp = simpleJobZODSchema.parse(req.body);
      const a = new Date();
      data = { ...data, ...temp };
    } else if (data.job === "freelance") {
      const temp = freelanceZODSchema.parse(req.body);
      if (temp.budget.budgetType === "Fixed") {
        if (
          temp.budget.minimum < 5 ||
          temp.budget.maximum < temp.budget.minimum
        ) {
          return res
            .status(4000)
            .json({ message: "Invalid Minimum or maximum value" });
        }
      } else {
        if (temp.budget.price < 5) {
          return res
            .status(400)
            .json({ message: "Price shoule be greater than $5" });
        }
      }
      data = { ...data, ...temp };
    }

    const user = await EMPLOYER.findById(userId);
    if (!user || user.status == "deleted") {
      return res.status(401).json({ message: "User not found!" });
    }
    if (user.status == "suspended") {
      return res
        .status(403)
        .json({ message: "Suspendedd accounts cannot create job" });
    }

    let canCreate = false;
    let deadline = new Date();
    data.subscriptionId = "";
    // check for subscription
    if (user.currentSubscription) {
      //  subscription validity
      if (user.currentSubscription.end > new Date()) {
        canCreate = true;
        data.creationType = "subscription";
        data.stripeSubscriptionId = user.stripeProfileSubscriptionId;
        deadline = getDateNDaysFromNow(30);
      } else {
        user.currentSubscription = null;
        await user.save();
        return res.status(400).json({
          message: "Subscription Expired ",
          subscriptionRequired: true,
        });
      }
    }
    // check for oneTime creation
    else if (user.oneTimeCreate === true) {
      canCreate = true;
      data.creationType = "oneTime";
      user.oneTimeCreate = false;
      deadline = getDateNDaysFromNow(30);
    }
    // check for free trial
    else {
      if (
        user.freeTrial.availed === true &&
        user.freeTrial.end > new Date() &&
        user.jobsCreated < 5
      ) {
        canCreate = true;
        data.creationType = "free";
        deadline = getDateNDaysFromNow(14);
      }
    }

    // if possible create job
    if (canCreate === true) {
      user.jobsCreated = user.jobsCreated + 1;
      let tempData = {
        title: data.title,
        description: data.description,
        employerId: userId,
        job: data.job,
        creationType: data.creationType,
        stripeSubscriptionId: data.stripeSubscriptionId,
      };

      //  Add Simple job detials
      if (data.job === "simple") {
        tempData.simpleJobDetails = {
          jobType: data.jobType,
          category: data.category,
          minSalary: data.minSalary,
          maxSalary: data.maxSalary,
          locationCity: data.locationCity,
          locationState: data.locationState,
          experienceLevel: data.experienceLevel,
          deadline: data.deadline,
        };
        if (
          data.creationType == "free" &&
          data.deadline > getDateNDaysFromNow(15)
        ) {
          return res.status(400).json({
            message: "Deadline cannot be greateer than 14 days in Free Trial",
          });
        } else if (
          (data.creationType == "oneTime" ||
            data.creationType == "subscription") &&
          data.deadline > getDateNDaysFromNow(31)
        ) {
          return res
            .status(400)
            .json({ message: "Deadline cannot be greateer than 30 days" });
        }
      }
      // Add freelance job details
      else if (data.job === "freelance") {
        tempData.freelanceJobDetails = {
          requiredSkills: data.requiredSkills,
          budget: data.budget,
          durationDays: data.durationDays,
          experienceLevel: data.experienceLevel,
          files: data.files,
        };
      }
      // invalid job
      else {
        return res.status(400).json({
          message: "Invalid job " + data.job,
          subscriptionRequired: false,
        });
      }

      const job = new Job(tempData);
      job.deadline = deadline;
      await Promise.all([job.save(), user.save()]);

      return res.status(201).json({
        message: "Job created",
        subscriptionRequired: false,
        jobId: job._id,
      });
    }
    // ask user to subscribe or make oneTime payment
    else {
      return res.status(400).json({
        message: "Subscription Required to create job",
        subscriptionRequired: true,
      });
    }
  } catch (err) {
    console.log("❌ Error creating job: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Get job by Id
const getJobById = async (req, res) => {
  try {
    const jobId = req.params.id;
    console.log("Job Id :", jobId);
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid Job!" });
    }

    const job = await Job.findById(jobId)
      .populate(
        "employerId",
        "fullName profilePictureUrl jobsCreated ordersCompleted"
      )
      .lean();
    if (!job) {
      return res.status(404).json({ message: "No Job Found!" });
    }

    if (job.deadline < new Date() && job.status == "empty") {
      job.status = "expired";
      await job.save();
    }

    return res.status(200).json({ job });
  } catch (err) {
    console.log("❌ Error getting job by id: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// GET All Jobs
const getAllJobs = async (req, res) => {
  try {
    const {
      limit = 10,
      skip = 0,
      category,
      tags,
      status = "empty",
      jobType,
      employerId,
      location,
      text,
    } = req.query;

    const filters = {};

    // get user to check if he had saved this job
    const user = await FREELANCER.findById(req.user?._id).select("savedJobs");

    // Filter by job status
    if (status && status !== "expired") {
      filters.status = status;
    } else {
      if (req.user?.role !== "admin") {
        filters.status = "active";
      }
    }

    // Filter by category
    if (category) {
      filters["simpleJobDetails.category"] = {
        $regex: category,
        $options: "i",
      };
    }

    // Filter by jobType
    if (jobType) {
      filters["simpleJobDetails.jobType"] = jobType;
    }

    // Filter by tags
    if (tags) {
      const tagArray = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim());
      filters.tags = { $in: tagArray };
    }

    // Filter by employer ID
    if (employerId) {
      if (!mongoose.Types.ObjectId.isValid(employerId)) {
        return res.status(400).json({ message: "Invalid employerId" });
      }
      filters.employerId = employerId;
    }

    // Enhanced location search
    if (location) {
      const locationTerms = location.split(",").map((t) => t.trim());
      if (locationTerms.some((e) => e.toLowerCase() == "remote")) {
        filters.job = "freelance";
      } else {
        const locationFilters = locationTerms.map((term) => ({
          $or: [
            {
              "simpleJobDetails.locationCity": { $regex: term, $options: "i" },
            },
            {
              "simpleJobDetails.locationState": { $regex: term, $options: "i" },
            },
          ],
        }));

        if (filters.$or) {
          filters.$and = [{ $or: filters.$or }, ...locationFilters];
          delete filters.$or;
        } else {
          filters.$or =
            locationFilters.length === 1
              ? locationFilters[0].$or
              : locationFilters;
        }
      }
    }

    // Enhanced text search across relevant fields
    if (text) {
      const textTerms = text
        .split(" ")
        .map((t) => t.trim())
        .filter((t) => t);
      const textFilters = textTerms.map((term) => ({
        $or: [
          { title: { $regex: term, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
          { "simpleJobDetails.category": { $regex: term, $options: "i" } },
          { "simpleJobDetails.locationCity": { $regex: term, $options: "i" } },
          { "simpleJobDetails.locationState": { $regex: term, $options: "i" } },
          {
            "freelanceJobDetails.requiredSkills": {
              $regex: term,
              $options: "i",
            },
          },
        ],
      }));

      if (filters.$and) {
        filters.$and = [...filters.$and, ...textFilters];
      } else if (filters.$or) {
        filters.$and = [{ $or: filters.$or }, ...textFilters];
        delete filters.$or;
      } else {
        filters.$and = textFilters;
      }
    }

    const jobs = await Job.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select(
        "_id title description job status createdAt applicants simpleJobDetails.jobType simpleJobDetails.locationCity simpleJobDetails.locationState simpleJobDetails.minSalary simpleJobDetails.maxSalary freelanceJobDetails.budget"
      )
      .populate("employerId", "fullName")
      .lean();

    const transformedJobs = jobs.map((job) => ({
      ...job,
      applicants: job.applicants?.length ?? 0,
      saved:
        employerId == ""
          ? user?.savedJobs?.includes(job._id) === true
            ? true
            : false
          : "",
      match:
        employerId == ""
          ? calculateJobMatchPercentage(
              { title: job.title, description: job.description },
              {
                bio: user?.profile?.bio || "",
                skills: user?.profile?.skills || [],
              }
            )
          : "",
    }));

    return res.status(200).json({
      jobs: transformedJobs,
    });
  } catch (err) {
    console.log("❌ Error creating job: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// Save Job
const saveAJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job Id" });
    }

    const job = await Job.findById(jobId)
      .select("title")
      .populate("employerId", "fullName")
      .lean();
    if (!jobId) {
      return res.status(400).json({ message: "No Job found!" });
    }

    const userId = req.user._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user Id" });
    }

    const user = await FREELANCER.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "Invalid User" });
    }

    let canSave = true;
    for (const saved of user.savedJobs) {
      if (saved.toString() == jobId) {
        canSave = false;
        break;
      }
    }

    if (canSave == true) {
      user.savedJobs.push(new mongoose.Types.ObjectId(jobId));

      // Add to recent activity
      user.activity.unshift({
        title: "Saved " + job.title,
        subTitle: job.employerId.fullName,
        at: new Date(),
      });
      if (user.activity.length > 3) {
        user.activity.splice(3);
      }

      await user.save();

      return res.status(200).json({ message: "job Saved" });
    } else {
      return res.status(400).json({ message: "job already Saved" });
    }
  } catch (err) {
    console.log("❌ Error saving job: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// remove a saved job
const removeSavedJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job Id" });
    }

    const userId = req.user._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user Id" });
    }

    const user = await FREELANCER.findById(userId);
    if (!user) {
      return res.status(401).json({ message: "Invalid User" });
    }

    let canRemove = false;
    for (const saved of user.savedJobs) {
      if (saved.toString() == jobId) {
        canRemove = true;
        break;
      }
    }

    if (canRemove == true) {
      const filtered = user.savedJobs.filter(
        (e) => e.toString() != jobId.toString()
      );
      user.savedJobs = filtered;
      await user.save();

      return res
        .status(200)
        .json({ message: "Succefully removed from saved jobs" });
    } else {
      return res.status(400).json({ message: "Job not Saved" });
    }
  } catch (err) {
    console.log("❌ Error saving job: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const getAllSavedJobs = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user ID" });
    }

    const user = await FREELANCER.findById(userId).select("savedJobs");
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    const savedJobIds = user.savedJobs || [];

    // Slice the IDs array for pagination
    const paginatedIds = savedJobIds.slice(skip, skip + limit);

    const savedJobs = await Job.find({ _id: { $in: paginatedIds } })
      .sort({
        createdAt: -1,
      })
      .select(
        "_id title description job simpleJobDetails.jobType simpleJobDetails.locationCity simpleJobDetails.locationState simpleJobDetails.minSalary simpleJobDetails.maxSalary freelanceJobDetails.budget"
      )
      .populate("employerId", "fullName")
      .lean();

    const transformedJobs = savedJobs.map((job) => ({
      ...job,
      saved: true,
      match: calculateJobMatchPercentage(
        { title: job.title, description: job.description },
        { bio: user?.profile?.bio || "", skills: user?.profile?.skills || [] }
      ),
    }));

    return res.status(200).json({
      jobs: transformedJobs,
    });
  } catch (err) {
    console.log("❌ Error getting saved jobs: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// const updateJobSchema = z
//   .object({
//     title: z.string().min(3).optional(),
//     description: z.string().min(10).optional(),
//     jobType: z
//       .enum(["full-time", "part-time", "contract", "freelance"])
//       .optional(),
//     category: z.string().min(2).optional(),
//     tags: z.array(z.string()).optional(),
//     location: z
//       .string()
//       .min(2, "Please provide a valid job location")
//       .optional(),
//     price: z.number().positive().optional(),
//     plusBonus: z.boolean().optional(),
//     applicationDeadline: z.string().date().optional(),
//   })
//   .strict();

// const updateJob = async (req, res) => {
//   const jobId = req.params.id;
//   const employerId = req.user?._id;
//   const updates = updateJobSchema.parse(req.body);

//   const job = await Job.findOne({ _id: jobId, status: { $nin: ["deleted"] } });

//   if (!job) {
//     return res.status(404).json({ message: "Job not found" });
//   }

//   if (job.status === "expired" || job.status === "filled") {
//     return res.status(400).json({
//       message: `Cannot edit job because it is ${job.status}`,
//     });
//   }

//   // Check ownership
//   if (String(job.employerId) !== String(employerId)) {
//     return res.status(403).json({ message: "Not authorized to edit this job" });
//   }

//   // Apply updates
//   Object.assign(job, updates);
//   await job.save();

//   return res.status(200).json({
//     message: "Job updated successfully",
//     job,
//   });
// };

// const jobById = async (req, res) => {
//   const jobId = req.params.id;

//   // Find job by ID
//   const job = await Job.findOne({ _id: jobId, status: { $nin: ["deleted"] } })
//     .populate("employerId", "profile.fullName, profile.profilePictureUrl")
//     .populate(
//       "applicants.freelancerId",
//       "profile.fullName profile.profilePictureUrl"
//     );

//   if (!job) {
//     return res.status(400).json({ message: "No Job found!" });
//   }
//   if (!req.user?.role?.includes("admin") && job.status !== "active") {
//     return res.status(403).json({
//       message: "No active job found with this ID",
//     });
//   }

//   if (!job) {
//     return res.status(404).json({ message: "Job not found" });
//   }

//   return res.status(200).json({
//     message: "Job retrieved successfully",
//     job,
//   });
// };

// const saveAJob = async (req, res) => {
//   const userId = req.user?._id;
//   const jobId = req.params.id;

//   if (!mongoose.Types.ObjectId.isValid(jobId)) {
//     return res.status(400).json({ message: "Invalid job ID" });
//   }

//   // Find user with freelancer role
//   const user = await User.findOne({
//     _id: userId,
//     status: "active",
//     role: { $in: ["freelancer"] },
//   });

//   if (!user) {
//     return res
//       .status(403)
//       .json({ message: "Only active freelancers can save jobs" });
//   }

//   // Check if job exists
//   const job = await Job.findById(jobId);
//   if (!job) {
//     return res.status(404).json({ message: "Job not found" });
//   }

//   // Check if already saved
//   const alreadySaved = user.freelancerDetails?.savedJobs?.includes(jobId);
//   if (alreadySaved) {
//     return res.status(400).json({ message: "Job already saved" });
//   }

//   // Add jobId to savedJobs
//   user.freelancerDetails.savedJobs.push(jobId);
//   await user.save();

//   return res.status(200).json({
//     message: "Job saved successfully",
//     savedJobs: user.freelancerDetails.savedJobs,
//   });
// };

// const removeSavedJob = async (req, res) => {
//   const userId = req.user?._id;
//   const jobId = req.params.id;

//   if (!mongoose.Types.ObjectId.isValid(jobId)) {
//     return res.status(400).json({ message: "Invalid job ID" });
//   }

//   // Find user with freelancer role
//   const user = await User.findOne({
//     _id: userId,
//     status: "active",
//     role: { $in: ["freelancer"] },
//   });

//   const savedJobs = user.freelancerDetails?.savedJobs || [];

//   // Check if job is in savedJobs
//   const index = savedJobs.findIndex((id) => id.toString() === jobId);
//   if (index === -1) {
//     return res.status(404).json({ message: "Job not found in saved jobs" });
//   }

//   // Remove the jobId from savedJobs
//   savedJobs.splice(index, 1);
//   user.freelancerDetails.savedJobs = savedJobs;
//   await user.save();

//   return res
//     .status(200)
//     .json({ message: "Job removed from saved jobs", savedJobs });
// };

// const deleteJob = async (req, res) => {
//   const jobId = req.params.id;
//   const userId = req.user?._id;

//   const job = await Job.findOne({ _id: jobId, status: { $ne: "deleted" } });

//   if (!job) {
//     return res.status(404).json({ message: "Job not found" });
//   }

//   // Check if the logged-in user is the employer who created the job
//   if (req.user?.role.includes["admin"]) {
//     job.status = "deleted";
//     await job.save();
//     return res.status(200).json({ message: "Job deleted successfully" });
//   }

//   if (job.employerId.toString() !== userId.toString()) {
//     return res.status(403).json({ message: "Unauthorized to delete this job" });
//   }

//   // Mark the job as deleted
//   job.status = "deleted";
//   await job.save();

//   return res.status(200).json({ message: "Job deleted successfully" });
// };

export {
  createJob,
  getAllJobs,
  saveAJob,
  removeSavedJob,
  getAllSavedJobs,
  getJobById,
};

// createJob,
// updateJob,
// jobById,
// getAllJobs,
// saveAJob,
// removeSavedJob,
// deleteJob,
