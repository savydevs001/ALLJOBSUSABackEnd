import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import mongoose, { mongo } from "mongoose";
import FREELANCER from "../database/models/freelancer.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import getDateNDaysFromNow from "../utils/date-and-days.js";
import calculateJobMatchPercentage from "../utils/calculate-job-match.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import { notifyUser } from "./notification.controller.js";
import { getMemorySubscriptionns } from "./subscriptions.controller.js";

// POST job
const urlRegex =
  /^(?:https?:\/\/)?(?:localhost|\d{1,3}(?:\.\d{1,3}){3}|(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})(?::\d{2,5})?(?:\/[^\s]*)?$/i;

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
  jobModel: z.enum(["On-site", "Remote", "Hybrid"], {
    errorMap: () => ({ message: "Invalid job Model" }),
  }),
  category: z.string().min(2, "Category is required"),
  minSalary: z.number().min(0, "Minimum salary must be at least 0"),
  maxSalary: z.number().min(5, "Maximum salary must be at least 0"),
  salaryInterval: z.enum(["hourly", "weekly", "monthly", "yearly"]),
  locationCity: z.string().min(2, "City is required"),
  locationState: z.string().min(2, "State is required"),
  experienceLevel: z.enum(["Beginner", "Intermediate", "Expert"]),
  formLink: z
    .string()
    .regex(urlRegex, "Invalid Form Url")
    .optional()
    .or(z.literal("")),
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
  category: z.string().min(2, "Category is required"),
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
          jobModel: data.jobModel,
          category: data.category,
          minSalary: data.minSalary,
          maxSalary: data.maxSalary,
          locationCity: data.locationCity,
          locationState: data.locationState,
          experienceLevel: data.experienceLevel,
          deadline: data.deadline,
          formLink: data.formLink,
          salaryInterval: data.salaryInterval,
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
          category: data.category,
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
      if (
        data.job === "simple" &&
        new Date(data.deadline) < new Date(deadline)
      ) {
        deadline = new Date(data.deadline);
      }
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
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid Job!" });
    }

    const job = await Job.findById(jobId)
      .populate(
        "employerId",
        "fullName profilePictureUrl jobsCreated ordersCompleted about"
      )
      .lean();
    if (!job) {
      return res.status(404).json({ message: "No Job Found!" });
    }

    // if (job.deadline < new Date() && job.status == "empty") {
    //   job.status = "expired";
    //   await job.save();
    // }

    const transformed = {
      _id: job._id,
      alreadyApplied: job.applicants.some(
        (e) => e.userId?.toString() == userId?.toString()
      ),
      employerId: {
        _id: job.employerId._id,
        fullName: job.employerId.fullName,
        jobsCreated: job.employerId.jobsCreated,
        ordersCompleted: job.employerId.ordersCompleted,
        profilePictureUrl: job.employerId.profilePictureUrl,
        about: job.employerId.about,
      },
      status: job.status,
      title: job.title,
      description: job.description,
      job: job.job,
      simpleJobDetails: {
        locationCity: job.simpleJobDetails?.locationCity,
        locationState: job.simpleJobDetails?.locationState,
        minSalary: job.simpleJobDetails?.minSalary,
        maxSalary: job.simpleJobDetails?.maxSalary,
        formLink: job.simpleJobDetails?.formLink || "",
        jobType: job.simpleJobDetails.jobType || "",
        jobModel: job.simpleJobDetails.jobModel || "",
        salaryInterval: job.simpleJobDetails.salaryInterval || "",
        salaryInterval: job.simpleJobDetails.salaryInterval || "",
        deadline: job.simpleJobDetails.deadline,
      },
      freelanceJobDetails: {
        budget: {
          budgetType: job.freelanceJobDetails?.budget?.budgetType,
          price: job.freelanceJobDetails?.budget?.price,
          minimum: job.freelanceJobDetails?.budget?.minimum,
          maximum: job.freelanceJobDetails?.budget?.maximum,
          category: job.freelanceJobDetails?.category,
        },
        files: job.freelanceJobDetails.files || [],
      },
      deadline: job.deadline,
    };

    return res.status(200).json({ job: transformed });
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
      job,
      jobType,
      employerId,
      location,
      text,
    } = req.query;

    const userId = req.user?._id;

    let filters = {};
    if (job) {
      filters.job = job;
    }

    // get user to check if he had saved this job
    let user;
    if (req.user.role == "freelancer") {
      user = await FREELANCER.findById(userId).select(
        "savedJobs profile.bio profile.skills profile.professionalTitle category"
      );
    } else if (req.user.role === "job-seeker") {
      user = await JOBSEEKER.findById(userId).select(
        "savedJobs profile.bio profile.skills profile.professionalTitle category"
      );
    }

    // Filter by job status
    if (status && status !== "expired") {
      filters.status = status;
    } else {
      if (!["admin", "manager"].includes(req.user?.role)) {
        filters.status = "empty";
      }
    }

    // Filter by category
    if (category) {
      filters.$or = [
        { "simpleJobDetails.category": { $regex: category, $options: "i" } },
        { "freelanceJobDetails.category": { $regex: category, $options: "i" } },
      ];
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
          { title: { $regex: text, $options: "i" } },
          { description: { $regex: term, $options: "i" } },
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
        "_id title description deadline job status createdAt applicants simpleJobDetails.jobType simpleJobDetails.jobModel simpleJobDetails.salaryInterval simpleJobDetails.locationCity simpleJobDetails.locationState simpleJobDetails.category simpleJobDetails.minSalary simpleJobDetails.maxSalary freelanceJobDetails.budget freelanceJobDetails.category"
      )
      .populate("employerId", "fullName ")
      .lean();

    const transformedJobs = jobs.map((job) => {
      const isSaved = user?.savedJobs?.some((savedId) =>
        savedId.equals(job._id)
      );
      const match = user?.profile
        ? calculateJobMatchPercentage(
            {
              title: job.title,
              description: job.description,
              category:
                job.job === "freelance"
                  ? job.freelanceJobDetails?.category
                  : job.simpleJobDetails?.category,
            },
            {
              bio: user.profile.professionalTitle + user.profile.bio || " ",
              skills: user.profile.skills || [],
              category: user.category,
            }
          )
        : "";

      return {
        ...job,
        alreadyApplied: job.applicants.some(
          (e) => e.userId?.toString() == userId?.toString()
        ),
        applicants: job.applicants?.length ?? 0,
        saved: user ? isSaved : false,
        match: user ? match : "",
      };
    });

    return res.status(200).json({
      jobs: transformedJobs,
    });
  } catch (err) {
    console.log("❌ Error getting job: ", err);
    return res.status(500).json({ message: "Server Error", err });
  }
};

// Save Job
const saveAJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    const role = req.user?.role;

    if (!["freelancer", "job-seeker"].includes(role)) {
      return res.status(403).json({ message: "invalid user role" });
    }

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job Id" });
    }

    const job = await Job.findById(jobId)
      .select("title")
      .populate("employerId", "fullName")
      .lean();
    if (!job) {
      return res.status(400).json({ message: "No Job found!" });
    }

    const userId = req.user._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user Id" });
    }

    let user = null;
    if (role == "freelancer") {
      user = await FREELANCER.findById(userId);
    } else if (role == "job-seeker") {
      user = await JOBSEEKER.findById(userId);
    }

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
    const role = req.user?.role;

    if (!["freelancer", "job-seeker"].includes(role)) {
      return res.status(403).json({ message: "Invalid user role" });
    }

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job ID" });
    }

    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user ID" });
    }

    const Model = role === "freelancer" ? FREELANCER : JOBSEEKER;
    const user = await Model.findById(userId);
    if (!user || !Array.isArray(user.savedJobs)) {
      return res
        .status(404)
        .json({ message: "User not found or no saved jobs" });
    }

    const alreadySaved = user.savedJobs.some(
      (savedId) => savedId.toString() === jobId
    );

    if (!alreadySaved) {
      return res.status(400).json({ message: "Job not saved" });
    }

    // Remove the jobId from savedJobs
    user.savedJobs = user.savedJobs.filter(
      (savedId) => savedId.toString() !== jobId
    );
    await user.save();

    return res
      .status(200)
      .json({ message: "Successfully removed from saved jobs" });
  } catch (err) {
    console.error("❌ Error removing saved job:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// saved jobs of job-seeker
const getAllSavedJobs = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const role = req.user?.role;
    const userId = req.user?._id;

    if (!["freelancer", "job-seeker"].includes(role)) {
      return res.status(403).json({ message: "Invalid user role" });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user ID" });
    }

    const Model = role === "freelancer" ? FREELANCER : JOBSEEKER;
    const user = await Model.findById(userId).select(
      "savedJobs profile profile.professionalTitle profile.skills category profile.bio"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const savedJobIds = user.savedJobs || [];

    // If no saved jobs, return empty
    if (savedJobIds.length === 0) {
      return res.status(200).json({ jobs: [] });
    }

    // MongoDB can't preserve original order of IDs in $in,
    // but it's more efficient for large sets
    const savedJobs = await Job.find({ _id: { $in: savedJobIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "_id title deadline applicants description job simpleJobDetails.jobType simpleJobDetails.jobModel simpleJobDetails.category simpleJobDetails.locationCity simpleJobDetails.locationState simpleJobDetails.salaryInterval simpleJobDetails.minSalary simpleJobDetails.maxSalary freelanceJobDetails.category freelanceJobDetails.budget"
      )
      .populate("employerId", "fullName")
      .lean();

    const transformedJobs = savedJobs.map((job) => ({
      ...job,
      saved: true,
      alreadyApplied: job.applicants.some(
        (e) => e.userId.toString() == userId.toString()
      ),
      match: calculateJobMatchPercentage(
        {
          title: job.title,
          description: job.description,
          category:
            job.job === "freelance"
              ? job.freelanceJobDetails?.category
              : job.simpleJobDetails?.category,
        },
        {
          bio: user.profile.professionalTitle + user.profile.bio || " ",
          skills: user.profile.skills || [],
          category: user.category,
        }
      ),
    }));

    return res.status(200).json({ jobs: transformedJobs });
  } catch (err) {
    console.error("❌ Error getting saved jobs: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get all jobs of employer
const myJobPostings = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const text = req.query.text?.trim();
    const status = req.query.status?.trim();
    const userId = req.user?._id;
    const job = req.query.job;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const textTerms = text
      ? text
          .split(" ")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    // Base filter
    const baseFilter = { employerId: new mongoose.Types.ObjectId(userId) };
    if (status && status !== "") {
      baseFilter.status = status;
    }

    if (job && job != "") {
      baseFilter.job = job;
    }

    // Text search
    const textFilter =
      textTerms.length > 0
        ? {
            $and: textTerms.map((term) => {
              const regex = new RegExp(term, "i");
              return {
                $or: [
                  { title: { $regex: regex } },
                  { description: { $regex: regex } },
                ],
              };
            }),
          }
        : {};

    const finalFilter = {
      ...baseFilter,
      ...textFilter,
    };

    const jobs = await Job.find(finalFilter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const transformedData = jobs.map((e) => ({
      _id: e._id,
      title: e.title,
      status: e.status,
      job: e.job,
      salaryInterval:
        e.job == "simple" ? e.job?.simpleJobDetails?.salaryInterval : "",
      location:
        e.job == "freelance"
          ? "remote"
          : e.simpleJobDetails.locationCity +
            " " +
            e.simpleJobDetails.locationState,
      budget: {
        budgetType:
          e.job == "freelance" &&
          e.freelanceJobDetails.budget.budgetType == "Start"
            ? "Start"
            : "Fixed",
        price: e.job == "freelance" ? e.freelanceJobDetails.budget.price : 0,
        minimum:
          e.job == "freelance"
            ? e.freelanceJobDetails.budget.minimum
            : e.simpleJobDetails.minSalary,
        maximum:
          e.job == "freelance"
            ? e.freelanceJobDetails.budget.maximum
            : e.simpleJobDetails.maxSalary,
      },
      applicantCount: e.applicants?.length || 0,
      createdAt: e.createdAt,
    }));

    return res.json({ jobs: transformedData });
  } catch (err) {
    console.error("❌ Error getting job postings:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// get job for edit
const getJobForEdit = async (req, res) => {
  try {
    const jobMode = req.query.job;
    const jobId = req.params.id;
    if (!jobMode || !["freelance", "simple"].includes(jobMode)) {
      return res.status(400).json({ message: "Invalid job" });
    }

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job id" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.employerId.toString() != req.user?._id) {
      return res.status(400).json({ message: "You cannot edit this job" });
    }

    if (job.status !== "empty") {
      return res
        .status(400)
        .json({ message: "You cannot edit this job, as it is already filled" });
    }

    if (job.job != jobMode) {
      return res.status(400).json({ message: "Invalid job mode" });
    }

    const tranformData = {
      _id: job._id,
      title: job.title,
      description: job.description,
      job: job.job,
    };
    if (jobMode == "freelance") {
      tranformData.requiredSkills = job.freelanceJobDetails?.requiredSkills;
      tranformData.budget = job.freelanceJobDetails?.budget;
      tranformData.durationDays = job.freelanceJobDetails?.durationDays;
      tranformData.experienceLevel = job.freelanceJobDetails?.experienceLevel;
      tranformData.files = job.freelanceJobDetails?.files;
      tranformData.category = job.freelanceJobDetails?.category;

      return res.status(200).json({ job: tranformData });
    } else if (jobMode == "simple") {
      tranformData.jobType = job.simpleJobDetails?.jobType;
      tranformData.category = job.simpleJobDetails?.category;
      tranformData.minSalary = job.simpleJobDetails?.minSalary;
      tranformData.maxSalary = job.simpleJobDetails?.maxSalary;
      tranformData.locationCity = job.simpleJobDetails?.locationCity;
      tranformData.locationState = job.simpleJobDetails?.locationState;
      tranformData.experienceLevel = job.simpleJobDetails?.experienceLevel;
      tranformData.deadline = job.simpleJobDetails?.deadline;
      tranformData.formLink = job.simpleJobDetails?.formLink;
      tranformData.jobModel = job.simpleJobDetails.jobModel || "";
      tranformData.salaryInterval = job.simpleJobDetails.salaryInterval || "";

      return res.status(200).json({ job: tranformData });
    } else {
      return res.status(400).json({ message: "Invalid job" });
    }
  } catch (err) {
    console.log("❌ Error getting job for edit: ", err);
    return res.status(500).json({ message: "Error getting job", err });
  }
};

// update job by id
const updateJob = async (req, res) => {
  try {
    const jobMode = req.query.job;
    const jobId = req.params.id;
    const parsed = createJobZODSchema.parse(req.body);
    if (!jobMode || !["freelance", "simple"].includes(jobMode)) {
      return res.status(400).json({ message: "Invalid job" });
    }

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job id" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.employerId.toString() != req.user?._id) {
      return res.status(400).json({ message: "You cannot edit this job" });
    }

    if (job.status !== "empty") {
      return res
        .status(400)
        .json({ message: "You cannot edit this job, as it is already filled" });
    }

    if (job.job != jobMode) {
      return res.status(400).json({ message: "Invalid job mode" });
    }

    job.title = parsed.title;
    job.description = parsed.description;

    if (jobMode == "freelance") {
      const freelanceParsed = freelanceZODSchema.parse(req.body);
      job.freelanceJobDetails.requiredSkills = freelanceParsed.requiredSkills;
      job.freelanceJobDetails.budget = freelanceParsed.budget;
      job.freelanceJobDetails.durationDays = freelanceParsed.durationDays;
      job.freelanceJobDetails.experienceLevel = freelanceParsed.experienceLevel;
      job.freelanceJobDetails.files = freelanceParsed.files;
      job.freelanceJobDetails.category = freelanceParsed.category;

      await job.save();

      return res.status(200).json({ message: "job eidted successfully" });
    } else if (jobMode == "simple") {
      const simpleParsed = simpleJobZODSchema.parse(req.body);

      const createdAt = new Date(job.createdAt);
      const deadline = new Date(simpleParsed.deadline);

      switch (job.creationType) {
        case "free":
          const fifteenDays = 15 * 24 * 60 * 60 * 1000;
          if (deadline.getTime() > createdAt.getTime() + fifteenDays) {
            return res.status(400).json({
              message:
                "You cannot extend deadline to more than 15 days from date job is created",
            });
          }
          break;
        case "oneTime":
        case "subscription":
          const thirtyOneDays = 31 * 24 * 60 * 60 * 1000;
          if (deadline.getTime() > createdAt.getTime() + thirtyOneDays) {
            return res.status(400).json({
              message:
                "You cannot extend deadline to more than 30 days from date job is created",
            });
          }
          break;
        default:
          break;
      }

      job.simpleJobDetails.jobType = simpleParsed.jobType;
      job.simpleJobDetails.category = simpleParsed.category;
      job.simpleJobDetails.minSalary = simpleParsed.minSalary;
      job.simpleJobDetails.maxSalary = simpleParsed.maxSalary;
      job.simpleJobDetails.locationCity = simpleParsed.locationCity;
      job.simpleJobDetails.locationState = simpleParsed.locationState;
      job.simpleJobDetails.experienceLevel = simpleParsed.experienceLevel;
      job.simpleJobDetails.deadline = simpleParsed.deadline;
      job.simpleJobDetails.formLink = simpleParsed.formLink;
      job.simpleJobDetails.jobModel = simpleParsed.jobModel;
      job.simpleJobDetails.salaryInterval = simpleParsed.salaryInterval;
      job.deadline = simpleParsed.deadline;

      await job.save();

      return res.status(200).json({ message: "job eidted successfully" });
    } else {
      return res.status(400).json({ message: "Invalid job" });
    }
  } catch (err) {
    console.log("❌ Error getting job for edit: ", err);
    return res.status(500).json({ message: "Error getting job", err });
  }
};

// close a job
const closeAJob = async (req, res) => {
  try {
    const jobId = req.params.id;
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job id" });
    }

    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.employerId.toString() != req.user?._id) {
      return res.status(400).json({ message: "You cannot close this job" });
    }

    if (job.status == "deleted") {
      return res.status(400).json({ message: "Job already closed" });
    }

    if (job.status !== "empty") {
      return res.status(400).json({
        message: "You cannot close this job, as it is already filled",
      });
    }

    job.status = "deleted";
    await job.save();
    return res.status(200).json({ message: "Job Closed" });
  } catch (err) {
    console.log("❌ Error getting job for edit: ", err);
    return res.status(500).json({ message: "Error getting job", err });
  }
};

// get job applicants
const getJobApplicants = async (req, res) => {
  try {
    const userId = req.user?._id;
    const jobId = req.params.id;

    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job id" });
    }

    const job = await Job.findOne({ _id: jobId, employerId: userId })
      .select("title description applicants job")
      .populate(
        "applicants.userId",
        "_id fullName profilePictureUrl profile.professionalTitle profile.skills"
      );
    if (!job) {
      return res.status(404).json({ message: "Job not found!" });
    }

    const tranformed = {
      _id: job._id,
      title: job.title,
      description: job.description,
      job: job.job,
      applicants: job.applicants.map((e) => ({
        _id: e.userId._id,
        fullName: e.userId?.fullName,
        profilePictureUrl: e.userId?.profilePictureUrl,
        professionalTitle: e.userId?.profile.professionalTitle,
        skills: e.userId?.profile.skills || [],
      })),
    };

    return res.status(200).json({ data: tranformed });
  } catch (err) {
    console.log("❌ Error getting job applicants: ", err);
    return res
      .status(500)
      .json({ message: "Error getting job applicants", err });
  }
};

export {
  createJob,
  getAllJobs,
  saveAJob,
  removeSavedJob,
  getAllSavedJobs,
  getJobById,
  myJobPostings,
  getJobForEdit,
  updateJob,
  closeAJob,
  getJobApplicants,
};
