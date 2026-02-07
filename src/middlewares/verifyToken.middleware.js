// weak checking for JWT secret -> weak
// strict checking for JWT secret -> strict

import mongoose from "mongoose";
import ADMIN from "../database/models/admin.model.js";
import EMPLOYER from "../database/models/employers.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
import JOBSEEKER from "../database/models/job-seeker.model.js";
import { verifyToken } from "../utils/jwt.js";

const verifyTokenMiddleware =
  (checking = "strict") =>
  async (req, res, next) => {
    const authHeader = req.headers.authorization;

    let token = authHeader?.split(" ")[1];
    if (token) {
      token = token.trim();
    }
    if (!token) {
      if (checking === "strict") {
        return res.status(401).json({ message: "No token provided" });
      }
      return next();
    }

    try {
      const deocded = verifyToken(token);
      // console.log("decoded: ", deocded)
      if (!deocded && checking === "strict") {
        return res.status(401).json({ message: "Invalid token" });
      }
      req.user = deocded;
      if (mongoose.Types.ObjectId.isValid(req.user?._id)) {
        let tempUser;
        if (req.user?.role && req.user.role === "freelancer") {
          try {
            tempUser = await FREELANCER.findByIdAndUpdate(req.user._id, {
              lastOnline: Date.now(),
            }).select({
              status: 1,
            });
          } catch (err) {
            console.log("Error setting last online for user: ", err);
          }
        } else if (req.user?.role && req.user.role === "job-seeker") {
          try {
            tempUser = await JOBSEEKER.findById(req.user._id).select({
              status: 1,
            });
          } catch (err) {
            console.log("Error getting jobseeker in verify middleware ", err);
          }
        } else if (req.user?.role && req.user.role === "freelancer") {
          try {
            tempUser = await EMPLOYER.findById(req.user._id).select({
              status: 1,
            });
          } catch (err) {
            console.log("Error getting employer in verify middleware: ", err);
          }
        }
        // console.log("tempUser: ", tempUser)
        if (tempUser && tempUser.status == "deleted") {
          return res.status(401).json({ message: "No User Acccount found!" });
        }
        if (req?.user?.role == "admin") {
          const admin = await ADMIN.findOne().select("passwordChanged");
          if (admin.passwordChanged === true) {
            return res
              .status(401)
              .json({ message: "Password has been changed" });
          }
        }
      }
      return next();
    } catch (error) {
      console.log("Error in verifyTokenMiddleware: ", error);
      
      if (checking === "strict") {
        return res.status(401).json({ message: "Invalid token" });
      }
      return next();
    }
  };

export default verifyTokenMiddleware;
