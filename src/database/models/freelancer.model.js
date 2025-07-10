import mongoose from "mongoose";

const freelancerSchema = mongoose.Schema({
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

  //   Stripe
  stripeAccountId: { type: String, required: true },
  onboarded: { type: Boolean, default: false, required: true },
});

const FREELANCER = mongoose.model("freelancer", freelancerSchema);
export default FREELANCER;
