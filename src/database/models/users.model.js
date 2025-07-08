// models/User.js
import mongoose from "mongoose";
import { boolean, string } from "zod/v4";
const { Schema, model, Types } = mongoose;

// Profile sub-schema
const profileSchema = new Schema(
  {
    fullName: String,
    profilePictureUrl: String,
    bio: String,
  },
  { _id: false }
);

// Employer subscription sub-schema
const subscriptionSchema = new Schema(
  {
    planId: { type: Types.ObjectId, ref: "SubscriptionPlan" },
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
    startDate: Date,
    endDate: Date,
    autoRenew: { type: Boolean, default: true },
  },
  { _id: false }
);

// Employer details sub-schema
const employerDetailsSchema = new Schema(
  {
    companyName: String,
    industry: String,
    website: String,
    companySize: String,
    description: String,
    subscription: subscriptionSchema,
    bookmarkedFreelancers: [{ type: Types.ObjectId, ref: "User" }],
  },
  { _id: false }
);

// // Freelancer experience
// const experienceSchema = new Schema(
//   {
//     title: String,
//     company: String,
//     startDate: Date,
//     endDate: Date,
//     description: String,
//   },
//   { _id: false }
// );

// // Freelancer education
// const educationSchema = new Schema(
//   {
//     degree: String,
//     university: String,
//     graduationYear: Number,
//   },
//   { _id: false }
// );

// // Freelancer portfolio
// const portfolioSchema = new Schema(
//   {
//     title: String,
//     description: String,
//     url: String,
//   },
//   { _id: false }
// );

// Freelancer details sub-schema
const freelancerDetailsSchema = new Schema(
  {
    jobTitle: { type: String },
    jobTags: [{ type: String }],
    yearsOfExperience: { type: Number, min: 0 },
    rating: { type: Number, min: 0, max: 5, default: 0 },
    totalRatingSum: { type: Number, min: 0, default: 0 },
    projectsCompleted: { type: Number, default: 0, min: 0 },
    hourlyRate: { type: Number, min: 0 },
    location: { type: String }, // e.g., "New York, USA"
    lastOnline: { type: Date },
    description: { type: String, maxlength: 2000 },
    likeCount: { type: Number, default: 0, min: 0 },
    resumeUrl: String,
    features: [
      {
        type: String,
        enum: ["pro", "top rated", "new talent", "rising star"],
      },
    ],
    availability: {
      type: String,
      enum: ["full-time", "part-time", "contract"],
    },
    savedJobs: [
      {
        type: Types.ObjectId,
        ref: "Job",
      },
    ],
    portfolio: [String],
  },
  { _id: false }
);

// Main user schema
const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    passwordSalt: { type: String, required: true },
    stripeAccountId: { type: string, required: true },
    onboarded: { type: boolean, default: false, required: true },
    role: {
      type: [String],
      enum: ["employer", "freelancer", "admin"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },
    lastLogin: Date,
    resetPasswordToken: String,
    resetPasswordExpires: String,
    profile: profileSchema,
    employerDetails: employerDetailsSchema,
    freelancerDetails: freelancerDetailsSchema,
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

const User = model("User", userSchema);
export default User;
