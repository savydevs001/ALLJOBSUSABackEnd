// models/Transaction.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const transactionSchema = new Schema(
  {
    mode: { type: String, enum: ["profile-subscription"] },

    subscriptionDetails: {
      type: {
        userId: {
          type: mongoose.Types.ObjectId,
          ref: "employer",
        },
        sessionId: String,
        subscriptionId: {
          type: mongoose.Types.ObjectId,
          ref: "SubscriptionPlan",
        },
        stripeSubscriptionId: String,
        status: {
          type: String,
          enum: ["pending", "failed", "completed"],
          default: "pending",
        },
        completedAt: Date,
      },
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const TRANSACTION = model("Transaction", transactionSchema);
export default TRANSACTION;
