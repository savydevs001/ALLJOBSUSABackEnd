import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Types.ObjectId, ref: "Job", required: true },
    jobSeekerId: {
      type: mongoose.Types.ObjectId,
      ref: "jobSeeker",
      required: true,
    },
    employerId: {
      type: mongoose.Types.ObjectId,
      ref: "employer",
      required: true,
    },
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
  },
  { timestamps: true }
);

const Application = new mongoose.model("application", applicationSchema);

export default Application;
