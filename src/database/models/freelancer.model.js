import mongoose, { Types } from "mongoose";

const freelancerSchema = mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: String,
  profilePictureUrl: String,
  role: { type: [String], enum: ["freelancer", "job-seeker"] },
  activeRole: { type: String, required: true },
  password: {
    hash: String,
    salt: String,
  },
  temporaryPass: {
    password: String,
    createdAt: Date,
  },
  lastLogin: Date,
  status: {
    type: String,
    enum: ["active", "suspended", "deleted"],
    default: "active",
  },

  //   Stripe
  stripeAccountId: String,
  onboarded: { type: Boolean, default: false },

  //   freelance profile
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
    badge: {
      type: [String],
      enum: ["Top-rated", "New-talent", "Fast-response"],
      default: ["New-talent"],
    },
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
      profileViews: Number,
      applicationsSent: Number,
      interviewRequest: Number,
    },
    achievements: [String],
  },
  // saved jobs
  savedJobs: [{ type: Types.ObjectId, ref: "Job" }],
});

const FREELANCER = mongoose.model("freelancer", freelancerSchema);
export default FREELANCER;
