import mongoose, { Types } from "mongoose";

const jobSeekerSchema = mongoose.Schema(
  {
    fullName: { type: String, required: true },
    email: { type: String, required: true },
    phoneNumber: String,
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
    status: {
      type: String,
      enum: ["active", "suspended", "deleted"],
      default: "active",
    },

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
  },
  {
    timestamps: true,
  }
);

const JOBSEEKER = mongoose.model("jobSeeker", jobSeekerSchema);

export default JOBSEEKER;
