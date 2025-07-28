// models/Transaction.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const transactionSchema = new Schema(
  {
    mode: { type: String, enum: ["profile-subscription", "order"] },

    // susbscription details if mode is subscriptions
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

    // order details if mode is order
    orderDeatils: {
      orderId: { type: Types.ObjectId, ref: "Order" },
      freelancerId: { type: Types.ObjectId, ref: "freelancer" },
      totalAmount: Number,
      amountToBePaid: Number,
      status: {
        type: String,
        enum: [
          "payment_pending",
          "escrow_held",
          "released_to_freelancer",
          "refunded",
        ],
        default: "payment_pending",
      },

      // stripe
      stripeSessionId: String,
      stripeIntentId: String,
    },
  },

  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const TRANSACTION = model("Transaction", transactionSchema);
export default TRANSACTION;
