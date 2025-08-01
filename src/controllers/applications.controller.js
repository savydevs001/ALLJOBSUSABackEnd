import mongoose from "mongoose";
import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import Application from "../database/models/applications.model.js";

const applyZodSchema = z.object({
  jobId: z.string(),
});
const createApplication = async (req, res) => {
  const parsed = applyZodSchema.parse(req.body);
  try {
    const jobSeekerId = req.user?._id;
    if (!jobSeekerId || !mongoose.Types.ObjectId.isValid(jobSeekerId)) {
      return res.status(400).json({ message: "Invalid jobseeker Id" });
    }

    // job seeker validation
    const jobId = parsed.jobId;
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job Id" });
    }

    const jobSeeker = await JOBSEEKER.findById(jobSeekerId);
    if (!jobSeeker) {
      return res.status(400).json({ message: "Job Seeker not found" });
    }
    if (jobSeeker.status != "active") {
      return res
        .status(400)
        .json({ message: "Only Active accounts are allowed to apply" });
    }

    // job validation
    const job = await Job.findById(jobId).populate("employerId", "fullName");
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status != "empty") {
      return res.status(400).json({ message: "Job not active" });
    }
    if (job.job != "simple") {
      return res.status(400).json({ message: "Job is not a Professinal" });
    }

    // check if an application already exists
    const AlreadyApplied = await Application.countDocuments({
      jobId: job._id,
      jobSeekerId: jobSeeker._id,
    });
    if (AlreadyApplied > 0) {
      return res.status(400).json({ message: "Already applied to this job" });
    }

    // employer validation
    const employer = await EMPLOYER.findById(job.employerId);
    if (!employer) {
      return res.status(404).json({ message: "Invalid Employer" });
    }
    if (employer.status !== "active") {
      return res
        .status(400)
        .json({ message: "Employer account suspended or deleted" });
    }

    if (employer.email === jobSeeker.email) {
      return res
        .status(400)
        .json({ message: "Sender and receiver cannot be the same person" });
    }

    try {
      const mongooseSession = await mongoose.startSession();
      mongooseSession.startTransaction();

      // create application
      const application = new Application({
        jobId: job._id,
        jobSeekerId: jobSeekerId,
        employerId: employer._id,
      });

      // update job stats
      const alreadyApplied = job.applicants.some(
        (app) =>
          app.userId?.toString() === jobSeekerId.toString() &&
          app.role === "jobSeeker"
      );

      if (!alreadyApplied) {
        job.applicants.push({
          userId: jobSeekerId,
          role: "jobSeeker",
        });
      }

      // update job seeker activity
      // Add to recent activity
      jobSeeker.activity.unshift({
        title: `Applied to ${job.title}`,
        subTitle: employer.fullName,
        at: new Date(),
      });

      if (jobSeeker.activity.length > 3) {
        jobSeeker.activity.splice(3);
      }

      jobSeeker.profile.jobActivity.applicationsSent =
        (jobSeeker.profile?.jobActivity?.applicationsSent || 0) + 1;

      await application.save({ session: mongooseSession });
      await job.save({ session: mongooseSession });
      await jobSeeker.save({ session: mongooseSession });

      await mongooseSession.commitTransaction();
      mongooseSession.endSession();

      return res.status(200).json({
        message: "Applied successfully",
        applicationId: application._id,
      });
    } catch (err) {
      console.error("❌ Error creating application:", err);
      await mongooseSession.abortTransaction();
      mongooseSession.endSession();
      return res.status(500).json({ message: "Server Error" });
    }
  } catch (err) {
    console.log("❌ Error creating application: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// applicant applications
const getUserApplications = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;

    const userId = req.user?._id;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const applications = await Application.find({ jobSeekerId: userId })
      .populate("employerId", "_id fullName")
      .populate("jobId", "title description")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    return res.status(200).json({
      applications,
    });
  } catch (err) {
    console.log("❌ Error fetching Applications: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// received applications
const getReceivedJobApplications = async (req, res) => {
  try {
    const skip = parseInt(req.query.skip) || 0;
    const limit = parseInt(req.query.limit) || 10;
    const text = req.query.text?.trim();
    const status = req.query.status?.trim();
    const userId = req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const textTerms = text
      ? text.split(" ").map((t) => t.trim()).filter(Boolean)
      : [];

    const baseFilter = {
      employerId: new mongoose.Types.ObjectId(userId),
    };

    if (status) {
      baseFilter.status = status;
    }

    const matchStages = [baseFilter];

    if (textTerms.length > 0) {
      const orConditions = textTerms.map((term) => {
        const regex = new RegExp(term, "i");
        return {
          $or: [
            { "job.title": { $regex: regex } },
            { "jobSeeker.fullName": { $regex: regex } },
            { status: { $regex: regex } },
          ],
        };
      });
      matchStages.push(...orConditions);
    }

    const applications = await Application.aggregate([
      { $match: baseFilter },

      // Join with Job info
      {
        $lookup: {
          from: "jobs",
          localField: "jobId",
          foreignField: "_id",
          as: "job",
        },
      },
      { $unwind: "$job" },

      // Join with Job Seeker info
      {
        $lookup: {
          from: "jobseekers",
          localField: "jobSeekerId",
          foreignField: "_id",
          as: "jobSeeker",
        },
      },
      { $unwind: "$jobSeeker" },

      ...(textTerms.length > 0 ? [{ $match: { $and: matchStages } }] : []),

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      {
        $project: {
          _id: 1,
          jobId: 1,
          status: 1,
          createdAt: 1,
          jobTitle: "$job.title",
          jobBudget: "$job.budget",
          jobType: "$job.type",

          jobSeeker: {
            _id: "$jobSeeker._id",
            fullName: "$jobSeeker.fullName",
            email: "$jobSeeker.email",
            profilePictureUrl: {
              $ifNull: ["$jobSeeker.profilePictureUrl", ""],
            },
            country: "$jobSeeker.country",
            experience: "$jobSeeker.experience",
          },
        },
      },
    ]);

    const transformed = applications.map((a) => ({
      _id: a._id,
      jobId: a.jobId,
      status: a.status,
      createdAt: a.createdAt,
      appliedTo: a.jobTitle,
    //   job: {
    //     title: a.jobTitle,
    //     budget: a.jobBudget,
    //     type: a.jobType,
    //   },
      sender: a.jobSeeker,
    }));

    return res.status(200).json({ applications: transformed });
  } catch (err) {
    console.error("❌ Error getting received applications:", err);
    return res.status(500).json({ message: "Error getting received applications" });
  }
};


export { createApplication, getUserApplications, getReceivedJobApplications };
