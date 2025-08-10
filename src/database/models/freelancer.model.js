import mongoose, { Types } from "mongoose";

const resumeOrCoverSchema = mongoose.Schema(
  {
    title: String,
    url: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const payoutSchema = new mongoose.Schema(
  {
    amount: Number,
    stripePayoutId: String,
    status: String,
    createdAt: Date,
  },
  { _id: false }
);

const freelancerSchema = mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    profilePictureUrl: String,
    password: {
      hash: String,
      salt: String,
      resetToken: String,
      lastResetTokenTime: Date,
      resetTokenExpiry: Date,
    },
    // temporaryPass: {
    //   password: String,
    //   createdAt: Date,
    // },
    lastLogin: Date,
    lastOnline: { type: Date, default: new Date() },
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },

    //   Stripe
    stripeAccountId: String,
    onboarded: { type: Boolean, default: false },
    totalEarning: { type: Number, default: 0 },
    currentBalance: { type: Number, default: 0 },
    pendingClearence: { type: Number, default: 0 },
    tip: { type: Number, default: 0 },
    payoutHistory: [payoutSchema],

    // resume and cover
    canDownloadResume: { type: Boolean, default: false },
    canDownloadCover: { type: Boolean, default: false },
    createdResumes: [resumeOrCoverSchema],
    createdCovers: [resumeOrCoverSchema],

    stripeIntentForResume: String,

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
        type: String,
        enum: [
          "New",
          "Level-1",
          "Level-2",
          "Top-rated",
          "New-talent",
          "Fast-response",
          "Pro",
        ],
        default: "New",
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

    projectsCompleted: { type: Number, default: 0 },
    // saved jobs
    savedJobs: [{ type: Types.ObjectId, ref: "Job" }],

    rating: {
      isRated: { type: Boolean, default: false },
      totalRatings: Number,
      totalRatingsSum: Number,
      value: Number,
    },

    likedBy: { type: [String], default: [] },
  },
  {
    timestamps: true,
  }
);

const FREELANCER = mongoose.model("freelancer", freelancerSchema);
export default FREELANCER;
