import mongoose from "mongoose";
import { z } from "zod";
import Job from "../database/models/jobs.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import Application from "../database/models/applications.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import { notifyUser } from "./notification.controller.js";

const applyZodSchema = z.object({
  jobId: z.string(),
});
const createApplication = async (req, res) => {
  const parsed = applyZodSchema.parse(req.body);
  try {
    const userId = req.user?._id;
    const userRole = req.user?.role;
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user Id" });
    }

    // job seeker validation
    const jobId = parsed.jobId;
    if (!jobId || !mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({ message: "Invalid job Id" });
    }

    let user;
    switch (userRole) {
      case "freelancer":
        user = await FREELANCER.findById(userId);
        break;
      case "job-seeker":
        user = await JOBSEEKER.findById(userId);
        break;
      default:
        break;
    }

    if (!user) {
      return res.status(400).json({ message: "User not found" });
    }
    if (user.status != "active") {
      return res
        .status(400)
        .json({ message: "Only Active accounts are allowed to apply" });
    }
    if(!user.profile || !user.profile.professionalTitle){
      return res
        .status(400)
        .json({ message: "Please Complete your Profile first" });
    }

    // job validation
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }
    if (job.status != "empty") {
      return res.status(400).json({ message: "Job not active" });
    }
    if (userRole == "job-seeker" && job.job != "simple") {
      return res.status(400).json({ message: "Job is not a Professinal" });
    }
    if (userRole == "freelancer" && job.job != "freelance") {
      return res.status(400).json({ message: "Job is not a Freelance" });
    }

    // check if an application already exists
    const AlreadyApplied = await Application.countDocuments({
      jobId: job._id,
      applicantId: user._id,
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

    if (employer.email === user.email) {
      return res
        .status(400)
        .json({ message: "Sender and receiver cannot be the same person" });
    }

    const mongooseSession = await mongoose.startSession();
    mongooseSession.startTransaction();
    try {
      // create application
      const application = new Application({
        jobId: job._id,
        applicantId: user._id,
        employerId: employer._id,
        applicantModel:
          userRole == "job-seeker"
            ? "jobSeeker"
            : userRole == "freelancer"
            ? "freelancer"
            : "",
      });

      // // update job stats
      const alreadyApplied = job.applicants.some(
        (app) => app.userId?.toString() === userId.toString()
      );

      if (!alreadyApplied) {
        job.applicants.push({
          userId: userId,
          role: application.applicantModel,
        });
      }

      // Add to recent activity
      user.activity.unshift({
        title: `Applied to ${job.title}`,
        subTitle: employer.fullName,
        at: new Date(),
      });

      if (user.activity.length > 3) {
        user.activity.splice(3);
      }

      user.profile.jobActivity.applicationsSent =
        (user.profile?.jobActivity?.applicationsSent || 0) + 1;

      await application.save({ session: mongooseSession });
      await job.save({ session: mongooseSession });
      await user.save({ session: mongooseSession });

      await mongooseSession.commitTransaction();
      mongooseSession.endSession();

      await notifyUser({
        userId: employer._id.toString(),
        userMail: employer.email.toString(),
        ctaUrl: `applications/${application._id.toString()}`,
        from: user.fullName,
        message: "Applied to job: " + job._id.toString(),
        title: "New Application",
      });

      return res.status(200).json({
        message: "Applied successfully",
        applicationId: application._id,
      });
    } catch (err) {
      console.error("❌ Error creating application:", err);
      await mongooseSession.abortTransaction();
      mongooseSession.endSession();
      return res
        .status(500)
        .json({ message: "Server Error", err: err.message });
    }
  } catch (err) {
    console.log("❌ Error creating application: ", err);
    return res.status(500).json({ message: "Server Error", err: err.message });
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

    const applications = await Application.find({ applicantId: userId })
      .populate("employerId", "_id fullName")
      .populate("jobId", "title description")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const tranfromed = applications.map((e) => ({
      _id: e._id,
      jobId: {
        _id: e.jobId._id,
        title: e.jobId.title,
        description: e.jobId.description,
      },
      userId: userId,
      employerId: {
        _id: e.employerId._id,
        fullName: e.employerId.fullName,
      },
      status: e.status,
      createdAt: e.createdAt,
    }));

    return res.status(200).json({
      applications: tranfromed,
    });
  } catch (err) {
    console.log("❌ Error fetching Applications: ", err);
    return res
      .status(500)
      .json({ message: "Error fetching Applications", err: err.message });
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
    const applicantRole = req.query?.role;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Invalid user" });
    }

    const textTerms = text
      ? text
          .split(" ")
          .map((t) => t.trim())
          .filter(Boolean)
      : [];

    const baseFilter = { employerId: new mongoose.Types.ObjectId(userId) };
    if (status) baseFilter.status = status;
    if (applicantRole) {
      baseFilter.applicantModel =
        applicantRole == "job-seeker"
          ? "jobSeeker"
          : applicantRole == "freelancer"
          ? "freelancer"
          : "";
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

      // Lookup applicant dynamically
      {
        $lookup: {
          from: "freelancers",
          localField: "applicantId",
          foreignField: "_id",
          as: "freelancer",
        },
      },
      {
        $lookup: {
          from: "jobseekers",
          localField: "applicantId",
          foreignField: "_id",
          as: "jobSeeker",
        },
      },

      // Merge applicant into single field
      {
        $addFields: {
          applicant: {
            $cond: {
              if: { $eq: ["$applicantModel", "freelancer"] },
              then: { $arrayElemAt: ["$freelancer", 0] },
              else: { $arrayElemAt: ["$jobSeeker", 0] },
            },
          },
        },
      },

      // Apply text search if provided
      ...(textTerms.length > 0
        ? [
            {
              $match: {
                $and: textTerms.map((term) => {
                  const regex = new RegExp(term, "i");
                  return {
                    $or: [
                      { "job.title": { $regex: regex } },
                      { "applicant.fullName": { $regex: regex } },
                      { status: { $regex: regex } },
                    ],
                  };
                }),
              },
            },
          ]
        : []),

      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },

      // Final projection
      {
        $project: {
          _id: 1,
          jobId: 1,
          status: 1,
          createdAt: 1,
          appliedTo: "$job.title",
          jobBudget: "$job.budget",
          jobType: "$job.type",
          applicant: {
            _id: "$applicant._id",
            fullName: "$applicant.fullName",
            role: "$applicantModel",
            email: "$applicant.email",
            profilePictureUrl: {
              $ifNull: ["$applicant.profilePictureUrl", ""],
            },
            country: "$applicant.country",
            experience: "$applicant.experience",
          },
        },
      },
    ]);

    const tranformed = applications.map((e) => ({
      ...e,
      applicant: {
        ...e.applicant,
        role: e.applicant.role == "jobSeeker" ? "job-seeker" : e.applicant.role,
      },
    }));

    return res.status(200).json({ applications: tranformed });
  } catch (err) {
    console.error("❌ Error getting received applications:", err);
    return res
      .status(500)
      .json({ message: "Error getting received applications" });
  }
};

// get Application by Id
const getApplicationById = async (req, res) => {
  try {
    const id = req.params.id;
    const userId = req.user?._id;

    // Validate ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Application Id" });
    }

    // Query with safe population
    const application = await Application.findById(id)
      .populate(
        "jobId",
        "title description status job simpleJobDetails freelanceJobDetails jobId applicants deadline"
      )
      .populate(
        "applicantId",
        "fullName phoneNumber profilePictureUrl profile.professionalTitle profile.bio profile.skills profile.hourlyRate"
      )
      .populate("employerId", "fullName profilePictureUrl about jobsCreated");

    if (!application) {
      return res.status(404).json({ message: "No Application found" });
    }

    if (
      userId.toString() === application.employerId?._id?.toString() &&
      application.status == "pending"
    ) {
      application.status = "reviewed";
      await application.save();
    }

    const job = application.jobId || {};
    const employer = application.employerId || {};
    const applicant = application.applicantId || {};

    const transformed = {
      _id: application._id,
      status: application.status,
      job: {
        _id: job._id,
        title: job.title,
        description: job.description,
        status: job.status,
        jobType:
          job.job == "simple" ? job.simpleJobDetails?.jobType : "Freelance",
        minSalary:
          job.job == "simple"
            ? job.simpleJobDetails?.minSalary
            : job.freelanceJobDetails.budget?.budgetType == "Fixed"
            ? job.freelanceJobDetails.budget?.minimum
            : job.freelanceJobDetails.budget?.budgetType == "Start"
            ? job.freelanceJobDetails.budget?.price
            : "",
        maxSalary:
          job.job == "simple"
            ? job.simpleJobDetails?.maxSalary
            : job.freelanceJobDetails.budget?.budgetType == "Fixed"
            ? job.freelanceJobDetails.budget?.maximum
            : job.freelanceJobDetails.budget?.budgetType == "Start"
            ? job.freelanceJobDetails.budget?.price
            : "",
        city:
          job.job == "simple" ? job.simpleJobDetails?.locationCity : "Remote",
        state: job.job == "simple" ? job.simpleJobDetails?.locationState : null,
        experienceLevel:
          job.job == "simple"
            ? job.simpleJobDetails?.experienceLevel
            : job.freelanceJobDetails.experienceLevel || "",
        deadline: job.deadline ?? null,
        alreadyApplied: (job.applicants || []).some(
          (e) => e.userId?.toString() === userId?.toString()
        ),
      },
      employer: {
        _id: employer._id,
        fullName: employer.fullName,
        profilePictureUrl: employer.profilePictureUrl,
        about: employer.about,
        jobsCreated: employer.jobsCreated,
      },
      applicant: {
        _id: applicant._id,
        fullName: applicant.fullName,
        phoneNumber: applicant.phoneNumber,
        profilePictureUrl: applicant.profilePictureUrl,
        professionalTitle: applicant.profile?.professionalTitle ?? "",
        bio: applicant.profile?.bio ?? "",
        skills: applicant.profile?.skills ?? [],
        startingRate: applicant.profile?.hourlyRate ?? null,
      },
    };

    return res.status(200).json({ application: transformed });
  } catch (err) {
    console.error("Error getting application by id: ", err);
    return res.status(500).json({
      message: "Error getting application by id",
      error: err.message, // safer than returning full err
    });
  }
};

export {
  createApplication,
  getUserApplications,
  getReceivedJobApplications,
  getApplicationById,
};
