import mongoose, { Mongoose, Types } from "mongoose";

const employerSchema = mongoose.Schema(
  {
    email: { type: String, required: true },
    fullName: { type: String, required: true },
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
  },
  {
    timestamps: true,
  }
);

const EMPLOYER = mongoose.model("employer", employerSchema);
export default EMPLOYER;
