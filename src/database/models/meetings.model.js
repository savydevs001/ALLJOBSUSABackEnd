import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    sessionName: { type: String, required: true },
    hostId: {
      type: mongoose.Types.ObjectId,
      refPath: "hostModel",
      required: true,
    },
    hostModel: {
      type: String,
      required: true,
      enum: ["freelancer", "jobSeeker", "employer"],
    },
    withUserId: {
      type: mongoose.Types.ObjectId,
      refPath: "withUserModel",
      required: true,
    },
    withUserModel: {
      type: String,
      required: true,
      enum: ["freelancer", "jobSeeker", "employer"],
    },
    startTime: { type: Date, required: true },
    expiryTime: { type: Date, required: true },
    status: {
      type: String,
      enum: ["new", "completed", "expired", "empty", "cancelled", "rejected"],
      default: "new",
    },
    joiningTime: Date,
    endingTime: Date,
  },
  { timestamps: true }
);

const MEETING = mongoose.model("meeting", meetingSchema);

export default MEETING;
