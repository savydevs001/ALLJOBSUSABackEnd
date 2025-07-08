// models/SubscriptionPlan.js
import mongoose from "mongoose";
const { Schema, model } = mongoose;

const subscriptionPlanSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },

    description: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "USD",
    },

    duration: {
      type: String,
      enum: ["monthly", "annually"],
      required: true,
    },

    features: [
      {
        type: String,
        enum: [
          "priority_job_postings",
          "enhanced_candidate_analytics",
          "unlimited_job_posts",
        ],
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

const SubscriptionPlan = model("SubscriptionPlan", subscriptionPlanSchema);

export default SubscriptionPlan;
