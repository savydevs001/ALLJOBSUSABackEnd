import { z } from "zod";
import ADMIN from "../database/models/admin.model.js";
import { jwtToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

// create admin
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,}$/;
const createAdminZODSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      PASSWORD_REGEX,
      "Password must contain uppercase, lowercase, number, and special character"
    ),
  confirmPassword: z.string(),
});
const createAdminAccount = async (req, res) => {
  const data = createAdminZODSchema.parse(req.body);
  try {
    const admin = await ADMIN.findOne({ email: data.email });

    if (admin) {
      return res.status(400).json({ message: "Admin already exists" });
    }

    const { salt, hash } = hashPassword(data.password);
    const newAdmin = new ADMIN({
      email: data.email,
      password: {
        hash: hash,
        salt: salt,
      },
    });
    await newAdmin.save();

    const token = jwtToken(newAdmin, "admin", true);
    if (token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }

    return res.status(201).json({
      message: "Signup successful",
      token,
    });
  } catch (err) {
    console.log("❌ Error creating admin account: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// login admin
const loginAdminZODSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string("Password is required"),
});
const loginAdminAccount = async (req, res) => {
  const data = loginAdminZODSchema.parse(req.body);
  try {
    const admin = await ADMIN.findOne({ email: data.email });

    if (!admin) {
      return res.status(404).json({ message: "Invalid credentials" });
    }

    const isMatch = verifyPassword(
      data.password,
      admin.password.salt,
      admin.password.hash
    );
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwtToken(admin, "admin", true);
    if (token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }

    return res.status(201).json({
      message: "Signin successful",
      token,
    });
  } catch (err) {
    console.log("❌ Error logging in admin account: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};


export {createAdminAccount, loginAdminAccount}