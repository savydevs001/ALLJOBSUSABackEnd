// weak checking for JWT secret -> weak
// strict checking for JWT secret -> strict

import ADMIN from "../database/models/admin.model.js";
import FREELANCER from "../database/models/freelancer.model.js";
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

    // console.log("token: ", token)

    try {
      const deocded = verifyToken(token);
      // console.log("decoded: ", deocded)
      if (!deocded && checking === "strict") {
        return res.status(401).json({ message: "Invalid token" });
      }
      req.user = deocded;
      if (req.user?.role && req.user.role === "freelancer") {
        try {
          await FREELANCER.updateOne(
            { _id: req.user._id },
            { lastOnline: Date.now() }
          );
        } catch (err) {
          console.log("Error setting last online for user: ", err);
        }
      }
      if (req?.user?.role == "admin") {
        const admin = await ADMIN.findOne().select("passwordChanged");
        if (admin.passwordChanged === true) {
          return res.status(401).json({ message: "Password has been changed" });
        }
      }
      return next();
    } catch (error) {
      if (checking === "strict") {
        return res.status(401).json({ message: "Invalid token" });
      }
      return next();
    }
  };

export default verifyTokenMiddleware;
