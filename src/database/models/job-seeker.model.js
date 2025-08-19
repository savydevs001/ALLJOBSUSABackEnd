import mongoose, { Types } from "mongoose";
import { blockSchema } from "./employers.model.js";

const resumeOrCoverSchema = mongoose.Schema(
  {
    title: String,
    url: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const jobSeekerSchema = mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: String,
    profilePictureUrl: String,
    category: String,
    password: {
      hash: String,
      salt: String,
      resetToken: String,
      lastResetTokenTime: Date,
      resetTokenExpiry: Date,
    },
    lastLogin: Date,
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },
    isDeletedByAdmin: Boolean,

    //   profile
    profile: {
      professionalTitle: String,
      resumeUrl: String,
      bannerUrl: String,
      bio: String,
      hourlyRate: Number,
      skills: { type: [String], default: [] },
      projects: { type: [String], default: [] },
      samples: { type: [String], default: [] },
      freelancerWork: Boolean,
      openToWork: Boolean,
      website: String,
      loaction: String,
      experiences: [
        {
          jobTitle: String,
          companyName: String,
          jobType: {
            type: String,
            enum: [
              "Part-time",
              "Full-time",
              "Internship",
              "Freelance",
              "Contract",
            ],
          },
          startDate: Date,
          endDate: Date,
          isCurrentJob: Boolean,
          jobLoaction: String,
          jobDescription: String,
        },
        {
          _id: false,
        },
      ],
      jobActivity: {
        profileViews: { type: [String], default: [] },
        applicationsSent: { type: Number, default: 0 },
        interviewRequest: Number,
      },
      achievements: [String],
    },

    // recent activity
    activity: {
      type: [
        {
          title: String,
          subTitle: String,
          at: Date,
        },
        { _id: false },
      ],
      default: [],
    },
    // saved jobs
    savedJobs: [{ type: Types.ObjectId, ref: "Job" }],

    likedBy: { type: [String], default: [] },

    // resume and cover
    canDownloadResume: { type: Boolean, default: false },
    canDownloadCover: { type: Boolean, default: false },
    createdResumes: [resumeOrCoverSchema],
    createdCovers: [resumeOrCoverSchema],

    // blocked
    blocked: [blockSchema],
  },
  {
    timestamps: true,
  }
);

const JOBSEEKER = mongoose.model("jobSeeker", jobSeekerSchema);

export default JOBSEEKER;
