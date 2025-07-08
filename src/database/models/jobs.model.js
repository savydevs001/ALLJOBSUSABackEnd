// models/Job.js
import mongoose from "mongoose";
const { Schema, Types } = mongoose;

// Applicant Subschema
const applicantSchema = new Schema(
  {
    freelancerId: { type: Types.ObjectId, ref: "User", required: true },
    appliedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["pending", "reviewed", "interview", "rejected", "hired"],
      default: "pending",
    },
  },
  { _id: false }
);

// Main Job Schema
const jobSchema = new Schema(
  {
    employerId: { type: Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    jobType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "freelance"],
      required: true,
    },
    location: { type: String, required: true },
    category: { type: String, required: true },
    tags: [{ type: String }],
    budget: {type: Number, required: true},
    plusBonus: { type: Boolean, default: false },

    status: {
      type: String,
      enum: ["active", "expired", "filled"],
      default: "active",
    },

    applicationDeadline: { type: Date, required: true },
    applicants: [applicantSchema],
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const Job = mongoose.model("Job", jobSchema);
export default Job;
