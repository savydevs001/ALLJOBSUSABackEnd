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
      lastLogin: new Date(),
    };
    if (req.file) {
      userDetails.profilePictureUrl =
        process.env.BACKEND_URL + `/${req.newName}`;
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
    } else if (role == "job-seeker" || role == "freelancer") {
      // Freelancer Signup
      const existing = await FREELANCER.findOne({
        email: email,
      });
      if (existing)
        return res.status(409).json({ message: "Email already registered" });

      userDetails.activeRole = role;
      userDetails.role = [role];
      console.log("user details: ", userDetails);
      const user = new FREELANCER(userDetails);
      await user.save();
      token = jwtToken(user, "freelancer");
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
    let dbRole = role;

    if (role === "employer") {
      // Employer Signin
      user = await EMPLOYER.findOne({
        email: email,
      });
      dbRole = "employer";
    } else if (role == "job-seeker" || role == "freelancer") {
      // Freelancer Signin
      user = await FREELANCER.findOne({
        email: email,
      });
      if (!user.role.includes(role)) {
        return res.status(400).json({ message: "Invalid Role" });
      }
    }

    if (!user || dbRole != role) {
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
    console.log("---------- Google response: ", tokenRes);
    if (!tokenRes.ok) {
      return res.status(400).json({
        message: "Failed to exchange code for token",
      });
    }

    const tokenResponse = await tokenRes.json();
    console.log("---------- Google response data: ", tokenResponse);
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

    // search Employers
    if (role == "employer") {
      let user = await EMPLOYER.findOneAndUpdate(
        { email: email },
        { lastLogin: new Date() }
      );
      if (!user) {
        user = await EMPLOYER.create({
          email: email,
          fullName: name,
          profilePictureUrl: picture,
          lastLogin: new Date(),
        });
      }
      token = jwtToken(user, role, true);
    }
    // Search Freelancers or Job-Seekers
    else if (role == "job-seeker" || role == "freelancer") {
      let user = await FREELANCER.findOneAndUpdate(
        { email: email },
        { activeRole: role, lastLogin: new Date() }
      );
      if (!user) {
        user = await FREELANCER.create({
          email: email,
          fullName: name,
          profilePictureUrl: picture,
          role: [role],
          activeRole: role,
          lastLogin: new Date(),
        });
      }
      if (!user.role.includes(role)) {
        user.role.push(role);
        await user.save();
      }
      token = jwtToken(user, role, true);
    }
    // Invalid role
    else {
      return res.status(400).json({ message: "Invalid user role" });
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
