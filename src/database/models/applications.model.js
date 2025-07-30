import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Types.ObjectId, ref: "Job", required: true },
    jobSeekerId: { type: mongoose.Types.ObjectId, ref: "jobSeeker", required: true },
  },
  { timestamps: true }
);

const Application = new mongoose.model("application", applicationSchema);

export default Application;
