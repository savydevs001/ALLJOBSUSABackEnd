import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

const trendingJobSchema = new Schema(
  {
    title: { type: String, required: true },
    company: { type: String, required: true },
    location: { type: String, required: true },
    minSalary: { type: Number, required: true },
    maxSalary: { type: Number, required: true },
    salaryInterval: {
      type: String,
      enum: ["hourly", "weekly", "monthly", "yearly"],
      required: true,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const TRENDING_JOB = model("trending_job", trendingJobSchema);
export default TRENDING_JOB;
