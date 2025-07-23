// weak checking for JWT secret -> weak
// strict checking for JWT secret -> strict

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
      return next();
    } catch (error) {
      if (checking === "strict") {
        return res.status(401).json({ message: "Invalid token" });
      }
      return next();
    }
  };

export default verifyTokenMiddleware;
