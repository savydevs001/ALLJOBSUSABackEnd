import mongoose, { Types } from "mongoose";

const refundSchema = new mongoose.Schema({
  orderId: { type: Types.ObjectId, ref: "Order", required: true },
  transactionId: { type: Types.ObjectId, ref: "Transaction", required: true },
  receiverId: {
    type: Types.ObjectId,
    refPath: "receiverModel",
    required: true,
  },
  receiverName: String,
  receiverEmail: String,
  receiverModel: {
    type: String,
    required: true,
    enum: ["employer", "jobSeeker"],
  },
  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  requestedDate: { type: Date, default: Date.now },
  stripeRefundId: String,
  completionOrCancelDate: Date,
  // amount: { type: Number, required: true },
});

const REFUND = mongoose.model("refund", refundSchema);
export default REFUND;
