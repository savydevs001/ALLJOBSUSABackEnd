// models/Notification.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const notificationSchema = new Schema(
  {
    userId: String,

    title: { type: String, required: true },
    message: { type: String, required: true },
    from: String, // name of sender
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
