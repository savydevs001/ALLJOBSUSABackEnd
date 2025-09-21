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
      platformCommissionPercentageForNonFreelancers: { type: Number, default: 0 },
      platformCommissionPercentageForNonFreelancersActive: { type: Boolean, default: true },
    },

    earnings: {
      resume: { type: Number, default: 0 },
      cover: { type: Number, default: 0 },
    },

    homePageAd: advertisementSchema,

    legalContent: {
      careersPage: { type: String },
      privacyPolicy: { type: String },
      termsOfUse: { type: String },
    },
  },
  {
    timestamps: true,
  }
);

const PlatformSettings = model("PlatformSettings", platformSettingsSchema);
export default PlatformSettings;
