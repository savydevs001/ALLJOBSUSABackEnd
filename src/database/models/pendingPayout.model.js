import mongoose from "mongoose";

const pendingPayoutSchema = new mongoose.Schema({
  freelancerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "freelancer",
    required: true,
  },
  type: {
    type: String,
    enum: ["order_payment", "order_tip"],
    default: "order_payment",
  },
  stripeAccountId: { type: String, required: true },
  amount: { type: Number, required: true },
  transferGroup: { type: String },
  releaseDate: { type: Date, required: true },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Order",
    required: true,
  },
  transactionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Transaction",
  },
  transferred: { type: Boolean, default: false },
  transferId: String,
});

const PENDING_PAYOUT = mongoose.model("pendingPayout", pendingPayoutSchema);

export default PENDING_PAYOUT;
