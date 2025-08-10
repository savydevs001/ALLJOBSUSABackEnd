import { z } from "zod";
import dotenv from "dotenv";
import crypto from "crypto";

import User from "../database/models/users.model.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
// import sendEmail from "../utils/emailSender.js";
import { notifyUser } from "./notification.controller.js";
import { createStripeExpressAcount } from "../services/stripe.service.js";
import { jwtToken } from "../utils/jwt.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import mongoose from "mongoose";
import req from "express/lib/request.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import enqueueEmail from "../services/emailSender.js";

dotenv.config();

const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,}$/;

// ZOD Schemas
const signupSchema = z
  .object({
    email: z.string().email("Invalid email format"),
    fullName: z.string().min(1, "Full name is required"),
    profilePictureUrl: z.string().optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters long")
      .regex(
        PASSWORD_REGEX,
        "Password must contain uppercase, lowercase, number, and special character"
      ),
    confirmPassword: z.string(),
    role: z.enum(["employer", "freelancer", "job-seeker"], {
      errorMap: () => ({
        message: "Invalid User Role",
      }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
    role: z.enum(["employer", "freelancer", "job-seeker"], {
      errorMap: () => ({
        message: "Invalid role",
      }),
    }),
  });

const signinSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string("Password is required"),
  rememberMe: z.boolean().default(false).optional(),
  role: z.enum(["employer", "freelancer", "job-seeker"], {
    errorMap: () => ({
      message: "Invalid role",
    }),
  }),
});
const forgotSchema = z.object({
  email: z.string().email("Invalid email format"),
  role: z.enum(["employer", "freelancer", "job-seeker"], {
    errorMap: () => ({
      message: "Invalid User Role",
    }),
  }),
});
const resetPasswordSchema = z.object({
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      PASSWORD_REGEX,
      "Password must contain uppercase, lowercase, number, and special character"
    ),
  confirmPassword: z.string(),
  email: z.string().email("Invalid email format"),
  token: z.string("Token is missing"),
  role: z.enum(["employer", "freelancer", "job-seeker"], {
    errorMap: () => ({
      message: "Invalid User Role",
    }),
  }),
});

// Controllers
const signUp = async (req, res) => {
  const { email, fullName, password, role, profilePictureUrl } =
    signupSchema.parse(req.body);

  try {
    const { salt, hash } = hashPassword(password);
    const userDetails = {
      email: email,
      fullName: fullName,
      profilePictureUrl: profilePictureUrl ?? "",
      password: {
        salt: salt,
        hash: hash,
      },
      lastLogin: new Date(),
    };

    if (req.file) {
      userDetails.profilePictureUrl =
        process.env.BACKEND_URL + `/${req.newName}`;
    } else if (profilePictureUrl) {
      userDetails.profilePictureUrl = profilePictureUrl;
    }

    let token = null;

    if (role === "employer") {
      // Employer Signup
      const existing = await EMPLOYER.findOne({
        email: email,
      });
      if (existing)
        return res
          .status(409)
          .json({ message: "Email already registered as a employer" });

      const user = new EMPLOYER(userDetails);
      await user.save();

      token = jwtToken(user, "employer");
    } else if (role == "freelancer") {
      // Freelancer Signup
      const existing = await FREELANCER.findOne({
        email: email,
      });
      if (existing)
        return res.status(409).json({ message: "Email already registered" });

      const user = new FREELANCER(userDetails);
      await user.save();
      token = jwtToken(user, "freelancer");
    } else if (role == "job-seeker") {
      // JOb seeker Signup
      const existing = await JOBSEEKER.findOne({
        email: email,
      });
      if (existing)
        return res.status(409).json({ message: "Email already registered" });

      const user = new JOBSEEKER(userDetails);
      await user.save();
      token = jwtToken(user, "job-seeker");
    }

    if (token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }
    return res.status(201).json({
      message: "Signup successful",
      token,
    });
  } catch (err) {
    console.error("❌ Sign-up error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const signIn = async (req, res) => {
  const { email, password, role, rememberMe } = signinSchema.parse(req.body);

  try {
    let user = null;
    if (role === "employer") {
      // Employer Signin
      user = await EMPLOYER.findOne({
        email: email,
      });
    } else if (role == "freelancer") {
      // Freelancer Signin
      user = await FREELANCER.findOne({
        email: email,
      });
    } else if (role == "job-seeker") {
      user = await JOBSEEKER.findOne({
        email: email,
      });
    }

    if (!user) {
      return res.status(401).json({ message: "No User found!" });
    }

    if (user.status == "suspended") {
      return res.status(403).json({ message: "Account is not active" });
    }
    if (user.status === "deleted") {
      return res.status(403).json({ message: "No user found!" });
    }

    if (!user.password.hash || !user.password.salt) {
      return res
        .status(400)
        .json({ message: "You have not setup password yet." });
    }

    const isMatch = verifyPassword(
      password,
      user.password.salt,
      user.password.hash
    );

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.lastLogin = new Date();
    user.activeRole = role;
    await user.save();

    const token = jwtToken(user, role, rememberMe);
    if (!token) {
      return res.status(500).json({ message: "Server Error" });
    }

    return res.status(200).json({
      message: "Login successful",
      token,
    });
  } catch (err) {
    console.error("❌ Sign-in error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const signOut = async (req, res) => {
  res.clearCookie(process.env.JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });
  return res.status(200).json({ message: "Signed out successfully" });
};

const forgotPassword = async (req, res) => {
  const parsed = forgotSchema.parse(req.body);
  try {
    let user;
    switch (parsed.role) {
      case "employer":
        user = await EMPLOYER.findOne({ email: parsed.email });
        break;
      case "freelancer":
        user = await FREELANCER.findOne({ email: parsed.email });
        break;
      case "job-seeker":
        user = await JOBSEEKER.findOne({ email: parsed.email });
        break;
      default:
        return res.status(400).json({ message: "Invalid role" });
    }

    if (!user) {
      return res
        .status(404)
        .json({ message: "User not found with this email" });
    }

    // if (
    //   user.password?.lastResetTokenTime &&
    //   Date.now() - new Date(user.password.lastResetTokenTime).getTime() <
    //     1000 * 60 * 5
    // ) {
    //   return res.status(400).json({ message: "Please try again in 5 minutes" });
    // }

    // Generate secure token
    const token = crypto.randomBytes(32).toString("hex");
    const expireTime = Date.now() + 1000 * 60 * 30; // 30 minutes

    user.password.resetToken = token;
    user.password.lastResetTokenTime = new Date(); // for oly allow token generation every 5 minutes
    user.password.resetTokenExpiry = new Date(expireTime);
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}?role=${parsed.role}&email=${user.email}`;
    enqueueEmail(
      user.email,
      "Reset Your Password",
      `<p>Click below to reset your password:</p>
       <a href="${resetLink}">${resetLink}</a>`
    );

    return res.status(200).json({
      message: "Password reset link sent to email",
      success: true,
    });
  } catch (err) {
    console.log("❌ Error generation reset token email: " + err);
    return res
      .status(500)
      .json({ message: "Error generation reset token email", err });
  }
};

const resetPassword = async (req, res) => {
  const { password, confirmPassword, token, role, email } =
    resetPasswordSchema.parse(req.body);

  if (password !== confirmPassword) {
    return res
      .status(400)
      .json({ message: "Password and confirm password do not match" });
  }

  let user;
  switch (role) {
    case "employer":
      user = await EMPLOYER.findOne({ email, "password.resetToken": token });
      break;
    case "freelancer":
      user = await FREELANCER.findOne({ email, "password.resetToken": token });
      break;
    case "job-seeker":
      user = await JOBSEEKER.findOne({ email, "password.resetToken": token });
      break;
    default:
      return res.status(400).json({ message: "Invalid role" });
  }

  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (
    user.password.resetTokenExpiry &&
    user.password.resetTokenExpiry < new Date()
  ) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  // create new salt
  const { salt, hash } = hashPassword(password);
  user.password.hash = hash;
  user.password.salt = salt;
  user.password.resetToken = undefined;

  await user.save();
  return res.status(200).json({ message: "Password reset successful" });
};

const createGoogleSignInLink = async (req, res) => {
  try {
    const role = req.query.role;
    const redirect_uri = process.env.FRONTEND_URL + "/login";
    if (!role || !["employer", "freelancer", "job-seeker"].includes(role)) {
      return res.status(400).json({ message: "Invalid Role" });
    }
    const state = Buffer.from(JSON.stringify({ role })).toString("base64");
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirect_uri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    return res.status(200).json({ url });
  } catch (err) {
    console.error("❌ Google create Signin link error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

const googleCallback = async (req, res) => {
  try {
    const { code, state } = req.query;
    if (!code) {
      return res.status(400).json({ message: "Code missing from request" });
    }

    const { role } = JSON.parse(Buffer.from(state, "base64").toString());
    if (!role || !["employer", "freelancer", "job-seeker"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }
    const redirect_uri = process.env.FRONTEND_URL + "/login";

    // Exchanging token with google
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: redirect_uri,
        grant_type: "authorization_code",
      }).toString(),
    });
    if (!tokenRes.ok) {
      return res.status(400).json({
        message: "Failed to exchange code for token",
      });
    }

    const tokenResponse = await tokenRes.json();
    const { id_token } = tokenResponse;
    const profileRes = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${id_token}`,
      {
        method: "GET",
      }
    );
    const profileResponse = await profileRes.json();
    const { email, name, picture } = profileResponse;
    let token = null;
    let newUser = false;

    // search Employers
    if (role == "employer") {
      let user = await EMPLOYER.findOneAndUpdate(
        { email: email },
        { lastLogin: new Date() }
      );
      if (!user) {
        newUser = true;
      }
      if (user) {
        token = jwtToken(user, role, true);
      }
    }
    // Search Freelancers or Job-Seekers
    else if (role == "freelancer") {
      let user = await FREELANCER.findOneAndUpdate(
        { email: email },
        { lastLogin: new Date() }
      );
      if (!user) {
        newUser = true;
      }
      if (user) {
        token = jwtToken(user, role, true);
      }
    } else if (role == "job-seeker") {
      let user = await JOBSEEKER.findOneAndUpdate(
        { email: email },
        { lastLogin: new Date() }
      );
      if (!user) {
        newUser = true;
      }
      if (user) {
        token = jwtToken(user, role, true);
      }
    }
    // Invalid role
    else {
      return res.status(400).json({ message: "Invalid user role" });
    }

    if (!newUser && token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }

    return res.status(201).json({
      message: "Signup successful",
      token: newUser ? "" : token,
      passwordSetupRequired: newUser,
      email: email,
      fullName: name,
      profilePictureUrl: picture,
      role: role,
    });
  } catch (err) {
    console.error("❌ Google callback Signin  error:", err);
    return res.status(500).json({ message: "Unable to Signin with google" });
  }
};

export {
  signUp,
  signIn,
  signOut,
  forgotPassword,
  resetPassword,
  createGoogleSignInLink,
  googleCallback,
};
