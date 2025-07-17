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

const interviewSchema = new Schema(
  {
    time: Date,
    link: String,
    result: String,
  },
  {
    _id: false,
  }
);

// Main Offer schema
const offerSchema = new Schema(
  {
    jobId: { type: Types.ObjectId, ref: "Job" }, // Optional
    senderId: { type: Types.ObjectId, ref: "freelancer", required: true },
    receiverId: { type: Types.ObjectId, ref: "employer", required: true },

    price: { type: Number, required: true },
    duration: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },

    milestones: [milestoneSchema], // Optional

    status: {
      type: String,
      enum: ["pending", "interviewing", "accepted", "rejected", "withdrawn"],
      default: "pending",
    },
    interviewDetails: interviewSchema,
    acceptedAt: { type: Date }, 
  },
  {
    timestamps: true,
  }
);

const Offer = model("Offer", offerSchema);
export default Offer;
