import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return null;
  }
};

const jwtToken = (user) => {
  try {
    if (!user) {
      return null;
    }
    const token = jwt.sign(
      {
        _id: user._id,
        role: user.role,
        email: user.email,
        profile: user.profile,
      },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );
    return token;
  } catch (err) {
    console.log("❌ Error generating JWT token: ", err);
    return null;
  }
};

export { verifyToken, jwtToken };
