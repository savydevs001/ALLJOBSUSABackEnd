import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const reportSchema = new Schema(
  {
    reporterId: {
      type: Types.ObjectId,
      refPath: "reporterModel",
      required: true,
    },
    reporterModel: {
      type: String,
      required: true,
      enum: ["employer", "jobSeeker", "freelancer"],
    },

    reportedId: {
      type: Types.ObjectId,
      refPath: "reporterModel",
      required: true,
    },
    reportedModel: {
      type: String,
      required: true,
      enum: ["employer", "jobSeeker", "freelancer"],
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

const Report = model("Report", reportSchema);
export default Report;
