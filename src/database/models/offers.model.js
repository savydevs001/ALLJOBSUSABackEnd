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
    senderId: { type: Types.ObjectId, ref: "freelancer", required: true },
    orderId: { type: Types.ObjectId, ref: "Order"}, // only when offer is accpeted
    receiverId: {
      type: Types.ObjectId,
      required: true,
      refPath: "receiverModel", //
    },

    receiverModel: {
      type: String,
      required: true,
      enum: ["employer", "jobSeeker"], //
    },
  
    price: { type: Number, required: true },
    duration: { type: Number, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },

    milestones: [milestoneSchema], // Optional

    status: {
      type: String,
      enum: [
        "pending",
        "reviewed",
        "interviewing",
        "accepted",
        "rejected",
        "withdrawn",
      ],
      default: "pending",
    },
    rejectionDetails: String,
    emailUpdates: { type: Boolean, default: false },
    acceptedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

const Offer = model("Offer", offerSchema);
export default Offer;
