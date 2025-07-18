// models/Notification.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const notificationSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },

    type: {
      type: String,
      enum: [
        "job_application_status",
        "offer_accepted",
        "payment_update",
        "chat_message",
        "system_announcement",
      ],
      required: true,
    },

    message: { type: String, required: true },

    relatedEntityId: { type: Types.ObjectId }, // Can be jobId, offerId, etc.

    read: { type: Boolean, default: false },

    createdAt: {
      type: Date,
      default: Date.now,
      index: false, // We'll define a conditional TTL index separately
    },
  },
  {
    timestamps: false, // we're only using createdAt
  }
);

notificationSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 2592000, // 30 days in seconds
  }
);


const Notification = model("Notification", notificationSchema);
export default Notification;
