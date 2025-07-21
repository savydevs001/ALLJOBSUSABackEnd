// weak checking for JWT secret -> weak
// strict checking for JWT secret -> strict

import { verifyToken } from "../utils/jwt.js";

const verifyTokenMiddleware =
  (checking = "strict") =>
  async (req, res, next) => {
    const authHeader = req.headers.authorization;
    // if (!authHeader?.startsWith("Bearer "))
    //   return res.status(401).json({ message: "No authorization header" });

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
      return next();
    } catch (error) {
      if (checking === "strict") {
        return res.status(401).json({ message: "Invalid token" });
      }
      return next();
    }
  };

export default verifyTokenMiddleware;
