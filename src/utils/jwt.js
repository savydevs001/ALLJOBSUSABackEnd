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

const jwtToken = (user, role, rememberMe = false) => {
  try {
    if (!user) {
      return null;
    }

    const expiresIn = rememberMe ? "30d" : "7d";
    const token = jwt.sign(
      {
        _id: user._id,
        role: role,
        email: user.email,
        fullName: user.fullName ?? "",
        profilePictureUrl: user.profilePictureUrl ?? "",
      },
      process.env.JWT_SECRET,
      { expiresIn: expiresIn }
    );
    return token;
  } catch (err) {
    console.log("❌ Error generating JWT token: ", err);
    return null;
  }
};

export { verifyToken, jwtToken };
