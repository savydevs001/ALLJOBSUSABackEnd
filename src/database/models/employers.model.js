import mongoose from "mongoose";

const employerSchema = mongoose.Schema({
  email: { type: String, required: true },
  fullName: { type: String, required: true },
  profilePictureUrl: String,
  password: {
    hash: { type: String, required: true },
    salt: { type: String, required: true },
  },
  temporaryPass: {
    password: String,
    createdAt: Date,
  },
  lastLogin: Date,
  status: {
    type: String,
    enum: ["active", "suspended", "deleted"],
    default: "active",
  },
});

const EMPLOYER = mongoose.model("employer", employerSchema);
export default EMPLOYER;
