import { z } from "zod";
import MANAGER from "../database/models/manager.model.js";
import { jwtToken, verifyToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import speakeasy from "speakeasy";
import QRcode from "qrcode";
import ADMIN from "../database/models/admin.model.js";

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

// generte 2FA Secret
const generate2FASecret = async (req, res) => {
  try {
    const manager = await MANAGER.findOne();
    if (manager.is2FAEnabled) {
      return res
        .status(200)
        .json({ message: "2FA already enabled", enabled: true });
    }

    const secret = speakeasy.generateSecret({
      name: "ALLJOBSUSA",
      length: 20,
    });

    manager.twoFASecret = secret.base32;
    await manager.save();

    // generate QR code
    const qrDataUrl = await QRcode.toDataURL(secret.otpauth_url);

    return res
      .status(200)
      .json({ secret: secret.base32, qrDataUrl, enabled: false });
  } catch (err) {
    console.log("❌ Error generating 2FA secret: " + err);
    return res.status(500).json({ message: "Error generation 2FA", err });
  }
};

// verify 2 FA setup
const verify2FaSetup = async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ message: "No Token in body" });
    }
    const manager = await MANAGER.findOne();
    if (manager.is2FAEnabled) {
      return res.status(400).json({ message: "2FA already enabled" });
    }

    const verified = speakeasy.totp.verify({
      secret: manager.twoFASecret,
      encoding: "base32",
      token,
      window: 1,
    });

    if (verified) {
      manager.is2FAEnabled = true;
      await manager.save();
      return res.status(200).json({ message: "Enabled" });
    } else {
      return res.status(400).json({ message: "Invalid token" });
    }
  } catch (err) {
    console.log("❌ Error verifying 2FA : " + err);
    return res.status(500).json({ message: "Error verifying 2FA", err });
  }
};

// reset password
const resetPassZodSchema = z.object({
  mode: z.enum(["admin", "manager"]),
  current: z.string(),
  new: z
    .string()
    .min(8, "Password must be at least 8 characters long")
    .regex(
      PASSWORD_REGEX,
      "Password must contain uppercase, lowercase, number, and special character"
    ),
  newConfirm: z.string(),
  twoFA: z.string().length(6),
});
const resetPassword = async (req, res) => {
  const parsed = resetPassZodSchema.parse(req.body);
  try {
    if (parsed.new !== parsed.newConfirm) {
      return res
        .status(400)
        .json({ message: "Password and Confirm Password do not match" });
    }

    if (parsed.current === parsed.new) {
      return res
        .status(400)
        .json({ message: "New and old password could not be same" });
    }

    const manager = await MANAGER.findOne();
    if (!manager.is2FAEnabled) {
      return res.status(400).json({ message: "2FA not enabled" });
    }

    const verified = speakeasy.totp.verify({
      secret: manager.twoFASecret,
      encoding: "base32",
      token: parsed.twoFA,
      window: 1,
    });

    if (verified) {
      let user;
      if (parsed.mode == "admin") {
        user = await ADMIN.findOne();
      } else if (parsed.mode == "manager") {
        user = manager;
      } else {
        return res.status(400).json({ message: "Invalid mode" });
      }

      //   check previous password match
      const matched = verifyPassword(
        parsed.current,
        user.password.salt,
        user.password.hash
      );
      if (matched) {
        const { hash, salt } = hashPassword(parsed.new);
        user.password.salt = salt;
        user.password.hash = hash;
        if (parsed.mode === "admin") {
          user.passwordChanged = true;
        }
        await user.save();

        return res
          .status(200)
          .json({ changed: true, message: "Password has been chnaged" });
      } else {
        return res
          .status(400)
          .json({ message: "Current password is incorrect" });
      }
    } else {
      return res.status(400).json({ message: "Invalid 2FA code" });
    }
  } catch (err) {
    console.log("❌ Error resetting password: " + err);
    return res.status(500).json({ message: "Error resetting password", err });
  }
};

//
export {
  loginManagerAccount,
  createManagerAccount,
  generate2FASecret,
  verify2FaSetup,
  resetPassword,
};
