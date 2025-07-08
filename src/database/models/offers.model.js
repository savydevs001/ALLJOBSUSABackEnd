// models/Offer.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

// Milestone sub-schema
const milestoneSchema = new Schema(
  {
    name: { type: String, required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
  },
  { _id: false }
);

// Main Offer schema
const offerSchema = new Schema(
  {
    jobId: { type: Types.ObjectId, ref: "Job" }, // Optional
    senderId: { type: Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Types.ObjectId, ref: "User", required: true },

    proposedAmount: { type: Number, required: true },
    description: { type: String, required: true },

    milestones: [milestoneSchema], // Optional

    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn"],
      default: "pending",
    },

    sentAt: { type: Date, default: Date.now },
    acceptedAt: { type: Date }, // only if accepted
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const Offer = model("Offer", offerSchema);
export default Offer;
