import mongoose, { Mongoose, Types } from "mongoose";

const resumeOrCoverSchema = mongoose.Schema(
  {
    title: String,
    url: String,
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

export const blockSchema = mongoose.Schema(
  {
    userId: String,
    at: Date,
  },
  { _id: false }
);

const employerSchema = mongoose.Schema(
  {
    email: { type: String, required: true },
    fullName: { type: String, required: true },
    profilePictureUrl: String,
    fcm_token: String,
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
    about: String,
    location: String,
    website: String,
    phoneNumber: String,
    bannerUrl: String,

    // jobs
    jobsCreated: { type: Number, default: 0 },
    ordersCompleted: { type: Number, default: 0 },
    ordersCancelled: { type: Number, default: 0 },
    oneTimeCreate: { type: Boolean, default: false },

    // free trail
    freeTrial: {
      availed: Boolean,
      start: Date,
      end: Date,
    },

    // subscriptions
    usedSessions: { type: [String], default: [] },
    susbscriptionRenew: Boolean,
    currentSubscription: {
      type: {
        subId: String,
        start: Date,
        end: Date,
      },
      _id: false,
    },
    pastSubscriptions: [
      {
        subId: String,
        start: Date,
        end: Date,
        _id: false,
      },
    ],

    // stripe
    stripeCustomerId: String,
    stripeProfileSubscriptionId: String,

    // resume and cover
    canDownloadResume: { type: Boolean, default: false },
    canDownloadCover: { type: Boolean, default: false },
    createdResumes: [resumeOrCoverSchema],
    createdCovers: [resumeOrCoverSchema],

    // blocked
    blocked: [blockSchema],
    confidentials: [blockSchema],

    // verify email
    emailVerified: { type: Boolean, default: false },
    emailVerifyCode: String,
    emailVerifyTokenExpiry: Date,
  },
  {
    timestamps: true,
  }
);

const EMPLOYER = mongoose.model("employer", employerSchema);
export default EMPLOYER;
