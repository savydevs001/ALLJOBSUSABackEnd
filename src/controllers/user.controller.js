import User from "../database/models/users.model.js";
import mongoose from "mongoose";
import { z } from "zod";
import dotenv from "dotenv";

import {
  generateOnBoardingAccountLink,
  generateStipeLoginLink,
  getStripeAccountbyId,
} from "../services/stripe.service.js";

dotenv.config();

// ZOD Schemas
const editUserSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    fullName: z.string().min(1, "Full name is required"),
    bio: z
      .string()
      .max(1000, "Bio must be less than 500 characters")
      .optional(),
  })
  .partial();

const editUserProfile = async (req, res) => {
  const { email, fullName, bio } = editUserSchema.parse(req.body);

  const userId = req.user?._id;
  const user = await User.findOne({
    _id: userId,
    status: { $nin: ["suspended", "deleted"] },
  });

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  // Update only provided fields
  if (email) user.email = email;
  if (fullName) user.profile.fullName = fullName;
  if (bio !== undefined) user.profile.bio = bio;

  await user.save();

  return res.status(200).json({ message: "User profile updated successfully" });
};

const getUser = async (req, res) => {
  const userId = req.user?._id;
  const user = await User.findOne(
    { _id: userId, status: { $nin: ["deleted"] } },
    {
      email: 1,
      status: 1,
      profile: 1,
      role: 1,
    }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json({
    user: user,
  });
};

const getUserById = async (req, res) => {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({ message: "No ID" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid User ID" });
  }

  const user = await User.findOne(
    {
      _id: id,
      role: { $nin: ["admin"] },
      status: { $nin: ["deleted"] },
    },
    {
      email: 1,
      status: 1,
      profile: 1,
      role: 1,
    }
  );

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  return res.status(200).json({
    user: user,
  });
};

const getAllUsers = async (req, res) => {
  // Parse query parameters
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  const [total, freelancers] = await Promise.all([
    User.countDocuments({
      role: { $in: ["freelancer", "employer"] },
      status: { $nin: ["deleted"] },
    }),
    User.find({
      role: { $in: ["freelancer", "employer"] },
      status: { $nin: ["deleted"] },
    })
      .select({
        email: 1,
        status: 1,
        profile: 1,
        role: 1,
      })
      .skip(skip)
      .limit(limit),
  ]);

  return res.status(200).json({
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    totalFreelancers: total,
    freelancers,
  });
};

const suspendProfile = async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: "No ID" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  const user = await User.findOne({ _id: id, status: { $nin: ["deleted"] } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.status === "suspended") {
    return res.status(400).json({ message: "User is already suspended" });
  }

  user.status = "suspended";
  await user.save();

  return res.status(200).json({
    message: "User suspended successfully",
    userId: user._id,
  });
};

const restoreProfile = async (req, res) => {
  const { id } = req.body;

  if (!id) {
    return res.status(400).json({ message: "No ID" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  const user = await User.findOne({ _id: id, status: { $nin: ["deleted"] } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.status != "suspended") {
    return res.status(400).json({ message: "User is not suspended" });
  }

  user.status = "active";
  await user.save();

  return res.status(200).json({
    message: "User profile restored successfully",
    userId: user._id,
  });
};

const deleteProfile = async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ message: "No ID" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ message: "Invalid ID" });
  }

  const user = await User.findOne({ _id: id, status: { $nin: ["deleted"] } });
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  user.status = "deleted";
  await user.save();

  return res.status(200).json({
    message: "User deleted successfully",
    userId: user._id,
  });
};

const onBoardUser = async (req, res) => {
  const userId = req.user?._id;

  const user = await User.findOne({
    _id: userId,
    status: "active",
  });

  if (!user) {
    return res.status(404).json({ message: "No Active User found" });
  }

  if (user.onboarded) {
    return res.status(409).json({ message: "Account already set" });
  }
  try {
    const link = await generateOnBoardingAccountLink(
      user.stripeAccountId,
      process.env.STRIPE_REFRESH_URL,
      process.env.STRIPE_RETURN_URL
    );
    // return res.status(302).redirect(link.url);
    return res.status(200).json({ link: link.url });
  } catch (err) {
    console.log("❌ Error generating stripe link: ", err);
    return res.status(500).json({ message: "Error genrating onboarding link" });
  }
};

const onBoardSuccess = async (req, res) => {
  const userId = req.user?._id;

  const user = await User.findById(userId);
  if (!user.stripeAccountId) {
    return res.status(400).json({ message: "Stripe account not found" });
  }

  if (user.onboarded) {
    return res.status(400).json({ message: "User already onboarded" });
  }

  try {
    const account = await getStripeAccountbyId(user.stripeAccountId);
    const isReady =
      account.details_submitted &&
      account.charges_enabled &&
      account.payouts_enabled;

    if (!isReady) {
      return res
        .status(403)
        .json({ message: "Account onboarding is incomplete" });
    }

    user.onboarded = isReady;
    await user.save();

    return res.status(200).json({
      onboardingComplete: isReady,
      status: {
        details_submitted: account.details_submitted,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
      },
    });
  } catch (err) {
    console.error("❌ Error checking onboarding status", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const generateStipeLogin = async (req, res) => {
  const userId = req.user?._id;

  const user = await User.findById(userId);
  if (!user.stripeAccountId) {
    return res.status(400).json({ message: "Stripe account not found" });
  }

  try {
    const link = await generateStipeLoginLink(user.stripeAccountId);
    // return res.status(302).redirect(link.url);
    return res.status(200).json({ link: link.url });
  } catch (err) {
    console.log("❌ Error generating stripe login link: ", err);
    return res.status(500).json({ message: "Error genrating login link" });
  }
};

export {
  editUserProfile,
  getUser,
  getUserById,
  getAllUsers,
  suspendProfile,
  restoreProfile,
  deleteProfile,
  onBoardUser,
  onBoardSuccess,
  generateStipeLogin
};
