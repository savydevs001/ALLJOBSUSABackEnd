// models/PlatformSettings.js
import mongoose from "mongoose";
const { Schema, model, Types } = mongoose;

// Advertisement Sub-schema
const advertisementSchema = new Schema(
  {
    imageUrl: { type: String, required: true },
    targetUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
);

// Testimonial Sub-schema
// const testimonialSchema = new Schema(
//   {
//     name: { type: String, required: true },
//     testimonial: { type: String, required: true },
//     imageUrl: { type: String },
//     active: { type: Boolean, default: true },
//   },
//   { _id: false }
// );

// Main Settings Schema
const platformSettingsSchema = new Schema(
  {
    _id: {
      type: String,
      default: "platform_settings",
    },

    pricing: {
      adPlacementFee: { type: Number, default: 0 },
      serviceFeePercentage: { type: Number, default: 0 },
      platformCommissionPercentage: { type: Number, default: 0 },
      platformCommissionPercentageActive: { type: Boolean, default: true },
    },

    homePageAd: advertisementSchema,

    legalContent: {
      careersPage: { type: String },
      privacyPolicy: { type: String },
      termsOfUse: { type: String },
    },

    // trendingJobs: [{ type: Types.ObjectId, ref: "Job" }],

    // satisfiedCustomers: [testimonialSchema],
  },
  {
    timestamps: true,
  }
);

const PlatformSettings = model("PlatformSettings", platformSettingsSchema);
export default PlatformSettings;
