// models/Transaction.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const transactionSchema = new Schema(
  {
    orderId: { type: Types.ObjectId, ref: "Order", required: true },

    payerId: { type: Types.ObjectId, ref: "User", required: true }, // Employer
    payeeId: { type: Types.ObjectId, ref: "User", required: true }, // Freelancer

    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },

    type: {
      type: String,
      enum: ["deposit", "release", "refund", "withdrawal"],
      required: true,
    },

    status: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },

    transactionDate: { type: Date, default: Date.now },

     paymentGatewayRef: {
      type: String,
      required: true,
      description: "Stripe paymentIntent ID or charge ID",
    },

    serviceFee: { type: Number, default: 0 }, // Platform commission

    payoutMethod: {
      type: String,
      enum: ["stripe_connect"],
      default: "stripe_connect",
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const Transaction = model("Transaction", transactionSchema);
export default Transaction;



