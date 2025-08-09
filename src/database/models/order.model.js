// models/Order.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

// Milestone Sub-schema
const milestoneSchema = new Schema(
  {
    name: { type: String, required: true },
    dueDate: { type: Date, required: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["completed", "pending"],
      default: "pending",
    },
  },
  { _id: false }
);

const attachedFileSchema = new Schema(
  {
    fileUrl: String,
    fileName: String,
    size: Number,
    dated: Date,
  },
  { _id: false }
);

// Dispute Details Sub-schema
const disputeSchema = new Schema(
  {
    reason: String,
    notes: String,
    raisedAt: { type: Date, default: Date.now },
    refundId: String, // in case if resolved in favour of employer
    resolutionStatus: {
      type: String,
      enum: [
        "pending",
        "resolved_in_favor_employer",
        "resolved_in_favor_freelancer",
      ],
      default: "pending",
    },
  },
  { _id: false }
);

// Order Schema
const orderSchema = new Schema(
  {
    offerId: { type: Types.ObjectId, ref: "Offer", required: true },
    jobId: { type: Types.ObjectId, ref: "Job" }, // optional
    employerId: {
      type: Types.ObjectId,
      required: true,
      refPath: "employerModel",
    },
    employerModel: {
      type: String,
      required: true,
      enum: ["employer", "jobSeeker"],
    },

    freelancerId: { type: Types.ObjectId, ref: "freelancer", required: true },
    intentId: String,

    title: { type: String, required: true },
    description: { type: String, required: true },

    totalAmount: { type: Number, required: true },
    tip: Number,

    status: {
      type: String,
      enum: [
        "payment_pending",
        "in_progress",
        "in_revision",
        "delivered",
        "completed",
        "disputed",
        "cancelled",
      ],
      default: "payment_pending",
    },

    deadline: Date,
    deliveryDate: Date,
    completionDate: Date,
    cancelledDate: Date,

    transactionId: { type: Types.ObjectId, ref: "Transaction", required: true },

    // milestones: [milestoneSchema],

    disputeDetails: disputeSchema,

    attachedFiles: [attachedFileSchema],

    delieveryFiles: [attachedFileSchema],
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

orderSchema.index({ offerId: 1 }, { unique: true });

const Order = model("Order", orderSchema);
export default Order;
