import { z } from "zod";
import dotenv from "dotenv";
import crypto from "crypto";

import User from "../database/models/users.model.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import sendEmail from "../utils/emailSender.js";
import { notifyUser } from "./notification.controller.js";
import { createStripeExpressAcount } from "../services/stripe.service.js";
import { jwtToken } from "../utils/jwt.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";

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
    role: z.enum(["employer", "freelancer"], {
      errorMap: () => ({
        message: "Role must be either 'employer' or 'freelancer'",
      }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
    role: z.enum(["employer", "freelancer"], {
      errorMap: () => ({
        message: "Role must be either 'employer' or 'freelancer'",
      }),
    }),
  });

const signinSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string("Password is required"),
  rememberMe: z.boolean(),
  role: z.enum(["employer", "freelancer"], {
    errorMap: () => ({
      message: "Role must be either 'employer' or 'freelancer'",
    }),
  }),
});
const forgotSchema = z.object({
  email: z.string().email("Invalid email format"),
});
const resetPasswordSchema = z.object({
  password: z.string().min(8, "Password must be at least 8 characters long"),
  token: z.string("Token is missing"),
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
      lastLogin: Date.now(),
    };
    if (req.file) {
      userDetails.profilePictureUrl = `${req.newName.replace(/\\/g, "/")}`;
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
    } else if (role === "freelancer") {
      // Freelancer Signup
      const existing = await FREELANCER.findOne({
        email: email,
      });
      if (existing)
        return res
          .status(409)
          .json({ message: "Email already registered as a freelancer" });

      const user = new FREELANCER(userDetails);
      try {
        const account = await createStripeExpressAcount(email);
        user.stripeAccountId = account.id;
      } catch (err) {
        console.log("❌ Error creating stripe account: " + err);
        return res.status(400).json({ message: "Error creating user account" });
      }
      await user.save();
      token = jwtToken(user, "freelancer");
    }

    if (token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }

    // res.cookie(process.env.JWT_COOKIE_NAME, token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "Strict",
    //   maxAge: 30 * 24 * 60 * 60 * 1000,
    // });

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
    } else if (role === "freelancer") {
      // Freelancer Signin
      user = await FREELANCER.findOne({
        email: email,
      });
    }

    if (!user) {
      return res.status(401).json({ message: "No User found!" });
    }

    if (["suspended", "deleted"].includes(user.status)) {
      return res.status(403).json({ message: "Account is not active" });
    }

    const isMatch = verifyPassword(
      password,
      user.password.salt,
      user.password.hash
    );

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    user.lastLogin = Date.now();
    await user.save();

    const token = jwtToken(user, role, rememberMe);
    if (!token) {
      return res.status(500).json({ message: "Server Error" });
    }

    // res.cookie(process.env.JWT_COOKIE_NAME, token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "Strict",
    //   maxAge:
    //     rememberMe == true ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000,
    // });

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
  const { email } = forgotSchema.parse(req.body);
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User not found with this email" });
  }

  // Generate secure token
  const token = crypto.randomBytes(32).toString("hex");
  const expireTime = Date.now() + 1000 * 60 * 60; // 1 hour

  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(expireTime);
  await user.save();

  const resetLink = `${process.env.FRONTEND_URL}/reset-password/${token}`;
  await sendEmail({
    to: user.email,
    subject: "Reset Your Password",
    html: `<p>Click below to reset your password:</p>
         <a href="${resetLink}">${resetLink}</a>`,
  });

  // clear cookies to ensure security
  res.clearCookie(process.env.JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  });

  return res.status(200).json({
    message: "Password reset link sent to email",
    link: resetLink,
  });
};

const resetPassword = async (req, res) => {
  const { password, token } = resetPasswordSchema.parse(req.body);

  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: {
      $gt: Date.now(),
    },
  });

  if (!user) {
    return res.status(400).json({ message: "Invalid or expired token" });
  }

  // create new salt
  const { salt, hash } = hashPassword(password);
  user.passwordHash = hash;
  user.passwordSalt = salt;

  // Clear reset token fields
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  //   notify
  notifyUser({
    userId: user._id,
    type: NotificationTypes.JOB_APPLICATION_STATUS,
    message: `<a href="/jobs/${job._id}"> ${job.title}<a> created successfully`,
    relatedEntityId: job._id,
  });
  return res.status(200).json({ message: "Password reset successful" });
};

export { signUp, signIn, signOut, forgotPassword, resetPassword };
