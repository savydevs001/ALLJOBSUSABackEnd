import mongoose from "mongoose";

const freelancerSchema = mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  phoneNumber: String,
  profilePictureUrl: String,
  password: {
    hash: { type: String, required: true },
    salt: { type: String, required: true },
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
  stripeAccountId: { type: String, required: true },
  onboarded: { type: Boolean, default: false, required: true },

  //   freelance profile
  profile: {
    professionalTitle: { type: String, required: true },
    resumeUrl: String,
    bannerUrl: String,
    bio: { type: String, required: true },
    hourlyRate: { type: Number, required: true },
    skills: { type: [String], required: true },
    projects: { type: [String], default: [] },
    samples: { type: [String], default: [] },
    freelancerWork: { type: Boolean, required: true },
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
        _id: false
      }
    ],
    jobActivity: {
      profileViews: Number,
      applicationsSent: Number,
      interviewRequest: Number,
    },
    achievements: [String],
  },
});

const FREELANCER = mongoose.model("freelancer", freelancerSchema);
export default FREELANCER;
