// models/Job.js
import mongoose from "mongoose";
const { Schema, Types } = mongoose;

// Applicant Subschema

const applicantSchema = new Schema(
  {
    userId: { type: Types.ObjectId, refPath: "applicants.role" },
    role: {
      type: String,
      required: true,
      enum: ["freelancer", "jobSeeker"],
    },
  },
  { _id: false }
);

// Main Job Schema
const jobSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    employerId: { type: Types.ObjectId, ref: "employer", required: true },
    job: { type: String, enum: ["simple", "freelance"], required: true },
    status: {
      type: String,
      enum: ["empty", "filled", "completed", "expired", "paused", "deleted"],
      default: "empty",
    },

    // job creation type
    creationType: {
      type: String,
      enum: ["free", "oneTime", "subscription"],
      required: true,
    },
    stripeSubscriptionId: String,

    // details
    simpleJobDetails: {
      jobType: {
        type: String,
        enum: ["Full-time", "Part-time"],
      },
      jobModel: {
        type: String,
        enum: ["On-site", "Remote", "Hybrid"],
      },
      category: { type: String, default: "not-specified" },
      minSalary: Number,
      maxSalary: Number,
      salaryInterval: {
        type: String,
        enum: ["hourly", "weekly", "monthly", "yearly"],
      },
      locationCity: String,
      locationState: String,
      experienceLevel: {
        type: String,
        enum: ["Beginner", "Intermediate", "Expert"],
      },
      deadline: Date,
      formLink: String,
      isConfidential: Boolean,
    },
    freelanceJobDetails: {
      requiredSkills: [String],
      category: { type: String, default: "not-specified" },
      budget: {
        budgetType: { type: String, enum: ["Fixed", "Start"] },
        price: Number,
        minimum: Number,
        maximum: Number,
      },
      durationDays: Number,
      experienceLevel: {
        type: String,
        enum: ["Beginner", "Intermediate", "Expert"],
      },
      files: { type: [{ name: String, url: String, _id: false }], default: [] },
    },

    isFeatured: { type: Boolean, default: false },

    // deadline for job delisting
    deadline: { type: Date, required: true },
    applicants: [applicantSchema],

    // analytics
    views: { type: Number, default: 0 },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const Job = mongoose.model("Job", jobSchema);
export default Job;
