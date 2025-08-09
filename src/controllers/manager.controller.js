import { z } from "zod";
import MANAGER from "../database/models/manager.model.js";
import { jwtToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";

// create manager
const PASSWORD_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d])[A-Za-z\d\S]{8,}$/;
const createManagerZODSchema = z.object({
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
const createManagerAccount = async (req, res) => {
  const data = createManagerZODSchema.parse(req.body);
  try {
    const manager = await MANAGER.find({});

    if (manager.length > 1) {
      return res.status(400).json({ message: "Manager already exists" });
    }

    const { salt, hash } = hashPassword(data.password);
    const newManager = new MANAGER({
      email: data.email,
      password: {
        hash: hash,
        salt: salt,
      },
    });
    await newManager.save();

    const token = jwtToken(newManager, "manager", true);
    if (token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }

    return res.status(201).json({
      message: "Signup successful",
      token,
    });
  } catch (err) {
    console.log("❌ Error creating newManager account: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

// login manager
const loginManagerZODSchema = z.object({
  email: z.string().email("Invalid email format"),
  password: z.string("Password is required"),
});
const loginManagerAccount = async (req, res) => {
  const data = loginManagerZODSchema.parse(req.body);
  try {
    const manager = await MANAGER.findOne({ email: data.email });

    if (!manager) {
      return res.status(404).json({ message: "Invalid credentials" });
    }

    const isMatch = verifyPassword(
      data.password,
      manager.password.salt,
      manager.password.hash
    );
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const token = jwtToken(manager, "manager", true);
    if (token === null) {
      console.log("❌ Error creating jwt token");
      return res.status(500).json({ message: "Server Error" });
    }

    return res.status(201).json({
      message: "Signin successful",
      token,
    });
  } catch (err) {
    console.log("❌ Error logging in manager account: ", err);
    return res.status(500).json({ message: "Server Error" });
  }
};

export { loginManagerAccount, createManagerAccount };
