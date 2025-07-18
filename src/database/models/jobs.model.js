// models/Job.js
import mongoose from "mongoose";
const { Schema, Types } = mongoose;

// Applicant Subschema
// const applicantSchema = new Schema(
//   {
//     freelancerId: { type: Types.ObjectId, ref: "User", required: true },
//     appliedAt: { type: Date, default: Date.now },
//     status: {
//       type: String,
//       enum: ["pending", "reviewed", "interview", "rejected", "hired"],
//       default: "pending",
//     },
//   },
//   { _id: false }
// );

// Main Job Schema
const jobSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    employerId: { type: Types.ObjectId, ref: "employer", required: true },
    job: { type: String, enum: ["simple", "freelance"], required: true },
    status: {
      type: String,
      enum: ["empty", "filled", "expired"],
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
      category: { type: String, default: "not-specified" },
      minSalary: Number,
      maxSalary: Number,
      locationCity: String,
      locationState: String,
      experienceLevel: {
        type: String,
        enum: ["Beginner", "Intermediate", "Expert"],
      },
      deadline: Date,
    },
    freelanceJobDetails: {
      requiredSkills: [String],
      budget: {
        budgetType: { type: String, enum: ["Fixed", "Start"] },
        price: Number,
        minimum: Number,
        maximum: Number,
        _id: false,
      },
      durationDays: Number,
      experienceLevel: {
        type: String,
        enum: ["Beginner", "Intermediate", "Expert"],
      },
      files: { type: [{ name: String, url: String, _id: false }], default: [] },
    },

    // deadline for job delisting
    deadline: { type: Date, required: true },
    applicants: [{ type: Types.ObjectId, ref: "freelancer" }],

    // analytics
    views: { type: Number, default: 0 },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const Job = mongoose.model("Job", jobSchema);
export default Job;
