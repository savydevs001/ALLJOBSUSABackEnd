import mongoose from "mongoose";
const { Schema, Types } = mongoose;

const applicantSchema = new Schema(
  {
    userId: { type: Types.ObjectId, refPath: "applicants.role" },
    role: {
      type: String,
      required: true,
      enum: ["freelancer", "jobSeeker", "employer"],
    },
    appliedAt: Date,
  },
  { _id: false }
);

const careerJobSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: String,
    salary: {
      min: { type: Number, required: true },
      max: { type: Number, required: true },
    },
    jobType: { type: String, enum: ["Part-Time", "Full-Time", "Contract"] },
    applicants: [applicantSchema],
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

const CareerJob = mongoose.model("careerJobSchema", careerJobSchema);
export default CareerJob;
