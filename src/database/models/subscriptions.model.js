import mongoose from "mongoose";
const { Schema, model } = mongoose;

const subscriptionPlanSchema = new Schema(
  {
    stripeProductId: { type: String },
    stripePriceId: { type: String },
    name: {
      type: String,
      required: true,
    },
    mode: {
      type: String,
      enum: ["subscription", "oneTime", "free"],
      required: true,
    },

    description: {
      type: String,
      required: true,
    },

    price: {
      type: Number,
      required: true,
    },

    totalDays: Number,

    interval: {
      type: String,
      enum: ["day", "week", "month", "year"],
      required: true,
    },
    interval_count: { type: Number, required: true },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

const SUBSCRIPTIONS_PLANS = model("SubscriptionPlan", subscriptionPlanSchema);

export default SUBSCRIPTIONS_PLANS;
