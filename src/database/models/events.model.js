import mongoose from "mongoose";
const { Schema } = mongoose;

const eventSchema = new Schema(
  {
    title: { type: String, required: true },
    description: { type: String, required: true },
    location: { type: String, required: true },
    dated: Date,
    eventFor: {type: String, enum: ["job-seeker", "employer", "freelancer"]},
    bannerUrl: String,
  },
  {
    timestamps: true,
  }
);

const EVENT = mongoose.model("events", eventSchema);
export default EVENT;
